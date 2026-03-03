// pages/admin/AdminJobsPage.tsx
// The job management page, accessible only to admins.
//
// What it does:
//   - Shows all jobs (both active and archived) as cards in a grid.
//   - Each card shows the job title, description, assigned workers, and action buttons.
//   - Create / Edit: a modal form lets the admin name and describe jobs.
//   - Archive: moves a job to "archived" status. Blocked if a worker is currently
//     clocked in to that job (button is disabled with a tooltip explaining why).
//   - Unarchive: restores an archived job back to "active".
//   - Delete: removes the job permanently. Only allowed when no workers are assigned.
//   - Assign Workers: opens a modal with checkboxes for all verified workers.
//     Saving replaces the entire assignment list for that job.
//   - Unassign: the X button next to a worker name removes just that one worker.
//     Shows an error banner if the backend rejects it (e.g. worker is clocked in).

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { jobsApi, usersApi } from '../../api/client';
import { Plus, Users, Edit2, Archive, ArchiveRestore, Trash2, X, MapPin } from 'lucide-react';
import type { Job, User } from '../../types';

const AdminJobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [form, setForm] = useState({ title: '', description: '', location: '', latitude: null as number | null, longitude: null as number | null });
  const locationContainerRef = useRef<HTMLDivElement>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [unassignError, setUnassignError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [jobsRes, usersRes] = await Promise.all([
        jobsApi.list(),
        usersApi.list({ status: 'verified', role: 'user' }),
      ]);
      setJobs(jobsRes.data);
      setUsers(usersRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  // Attach Google Places PlaceAutocompleteElement to the location container whenever the modal opens.
  useEffect(() => {
    const container = locationContainerRef.current;
    if (!container) return;
    const win = window as any;
    if (!win.google?.maps) return;

    let isMounted = true;
    win.google.maps.importLibrary('places').then(({ PlaceAutocompleteElement }: any) => {
      if (!isMounted || !container) return;
      container.innerHTML = '';

      const pac = new PlaceAutocompleteElement({ componentRestrictions: { country: 'nz' } });
      // Style to match the rest of the form inputs
      pac.style.setProperty('--gmp-input-height', '40px');
      pac.style.setProperty('--gmp-input-border-radius', '0.375rem');
      pac.style.setProperty('--gmp-input-border-color', '#cbd5e1');
      pac.style.setProperty('--gmp-input-font-size', '0.875rem');
      pac.style.width = '100%';
      if (editJob?.location) (pac as any).value = editJob.location;

      pac.addEventListener('gmp-select', async (e: any) => {
        const place = e.placePrediction.toPlace();
        await place.fetchFields({ fields: ['formattedAddress', 'location'] });
        setForm(p => ({
          ...p,
          location: place.formattedAddress || '',
          latitude: place.location.lat(),
          longitude: place.location.lng(),
        }));
      });

      container.appendChild(pac);
    });

    return () => {
      isMounted = false;
      if (container) container.innerHTML = '';
    };
  }, [showCreate, editJob]);

  const emptyForm = { title: '', description: '', location: '', latitude: null as number | null, longitude: null as number | null };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await jobsApi.create(form);
      setShowCreate(false);
      setForm(emptyForm);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJob) return;
    try {
      await jobsApi.update(editJob.id, { title: form.title, description: form.description, location: form.location, latitude: form.latitude, longitude: form.longitude });
      setEditJob(null);
      setForm(emptyForm);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleArchive = async (jobId: number) => {
    try {
      await jobsApi.update(jobId, { status: 'archived' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUnarchive = async (jobId: number) => {
    try {
      await jobsApi.update(jobId, { status: 'active' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (jobId: number) => {
    try {
      await jobsApi.delete(jobId);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAssign = async () => {
    if (!showAssign) return;
    try {
      await jobsApi.assign(showAssign, selectedUsers);
      setShowAssign(null);
      setSelectedUsers([]);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUnassign = async (jobId: number, userId: number) => {
    setUnassignError(null);
    try {
      await jobsApi.unassign(jobId, userId);
      fetchData();
    } catch (err: any) {
      setUnassignError(err.response?.data?.detail || 'Failed to remove worker');
    }
  };

  const openEdit = (job: Job) => {
    setEditJob(job);
    setForm({ title: job.title, description: job.description || '', location: job.location || '', latitude: job.latitude ?? null, longitude: job.longitude ?? null });
  };

  const openAssign = (jobId: number) => {
    setShowAssign(jobId);
    const job = jobs.find(j => j.id === jobId);
    setSelectedUsers(job?.assigned_users?.map(u => u.id) || []);
  };

  return (
    <div className="animate-fade-in" data-testid="admin-jobs-page">
      {unassignError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center justify-between">
          <span>{unassignError}</span>
          <button onClick={() => setUnassignError(null)} className="text-red-400 hover:text-red-600 ml-4"><X size={14} /></button>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary-900">Job Management</h1>
          <p className="text-primary-500 text-sm mt-1">Create and manage jobs, assign workers</p>
        </div>
        <button
          data-testid="create-job-button"
          onClick={() => { setShowCreate(true); setForm(emptyForm); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-600 transition-colors"
        >
          <Plus size={16} /> New Job
        </button>
      </div>

      {/* Job Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <div key={job.id} data-testid={`job-card-${job.id}`} className="bg-white rounded-lg border border-primary-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-heading font-semibold text-lg text-primary-900">{job.title}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-500'}`}>
                  {job.status}
                </span>
              </div>
              <p className="text-sm text-primary-500 line-clamp-2">{job.description || 'No description'}</p>

              {/* Location map */}
              {job.latitude && job.longitude && (
                <div className="mt-3 rounded-md overflow-hidden">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${job.latitude},${job.longitude}&zoom=15&size=600x160&scale=2&markers=color:orange%7C${job.latitude},${job.longitude}&key=${process.env.REACT_APP_GOOGLE_MAPS_KEY}`}
                    alt={job.location ?? 'Job location'}
                    className="w-full object-cover"
                    style={{ height: '110px' }}
                  />
                </div>
              )}
              {job.location && (
                <p className="text-xs text-primary-400 mt-1.5 flex items-center gap-1 truncate mb-3">
                  <MapPin size={11} className="shrink-0" />{job.location}
                </p>
              )}
              {!job.location && <div className="mb-4" />}

              {/* Assigned Users */}
              <div className="mb-4">
                <p className="text-xs font-medium text-primary-400 mb-2 uppercase tracking-wider">Assigned Workers</p>
                {job.assigned_users && job.assigned_users.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {job.assigned_users.map((u) => (
                      <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-md">
                        {u.name}
                        <button
                          data-testid={`unassign-${job.id}-${u.id}`}
                          onClick={() => handleUnassign(job.id, u.id)}
                          className="text-primary-400 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-primary-400">No workers assigned</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-primary-100">
                <button data-testid={`assign-job-${job.id}`} onClick={() => openAssign(job.id)} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-700 transition-colors">
                  <Users size={14} /> Assign
                </button>
                <button data-testid={`edit-job-${job.id}`} onClick={() => openEdit(job)} className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors">
                  <Edit2 size={14} /> Edit
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {job.status === 'active' && (
                    <button
                      data-testid={`archive-job-${job.id}`}
                      onClick={() => handleArchive(job.id)}
                      disabled={job.has_active_session}
                      title={job.has_active_session ? 'A worker is currently clocked in — clock out first' : 'Archive job'}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                        job.has_active_session
                          ? 'text-primary-300 cursor-not-allowed'
                          : 'text-orange-500 hover:text-orange-700'
                      }`}
                    >
                      <Archive size={14} /> Archive
                    </button>
                  )}
                  {job.status === 'archived' && (
                    <button
                      data-testid={`unarchive-job-${job.id}`}
                      onClick={() => handleUnarchive(job.id)}
                      title="Restore job to active"
                      className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                    >
                      <ArchiveRestore size={14} /> Unarchive
                    </button>
                  )}
                  <button
                    data-testid={`delete-job-${job.id}`}
                    onClick={() => handleDelete(job.id)}
                    disabled={!!(job.assigned_users && job.assigned_users.length > 0)}
                    title={job.assigned_users && job.assigned_users.length > 0 ? 'Remove all assigned workers before deleting' : 'Delete job'}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      job.assigned_users && job.assigned_users.length > 0
                        ? 'text-primary-300 cursor-not-allowed'
                        : 'text-red-500 hover:text-red-700'
                    }`}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="col-span-full text-center py-12 text-primary-400">No jobs created yet</div>
        )}
      </div>

      {/* Create/Edit Job Modal */}
      {(showCreate || editJob) && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" data-testid="job-modal">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-heading font-semibold text-lg text-primary-900 mb-4">{editJob ? 'Edit Job' : 'Create Job'}</h3>
            <form onSubmit={editJob ? handleUpdate : handleCreate} className="space-y-4">
              <input data-testid="job-title-input" type="text" placeholder="Job Title" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent" required />
              <textarea data-testid="job-description-input" placeholder="Description" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" rows={3} />
              <div ref={locationContainerRef} className="w-full" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setEditJob(null); }} className="flex-1 h-10 border border-primary-200 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-50">Cancel</button>
                <button data-testid="job-submit-button" type="submit" className="flex-1 h-10 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-600">{editJob ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Modal */}
      {showAssign && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" data-testid="assign-modal">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-xl animate-fade-in">
            <h3 className="font-heading font-semibold text-xl text-primary-900 mb-5">Assign Workers</h3>
            <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
              {users.map((user) => (
                <label key={user.id} className="flex items-center gap-3 p-3 rounded-md border border-primary-100 hover:bg-primary-50 cursor-pointer transition-colors" data-testid={`assign-checkbox-${user.id}`}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUsers(prev => [...prev, user.id]);
                      else setSelectedUsers(prev => prev.filter(id => id !== user.id));
                    }}
                    className="rounded border-primary-300 text-accent focus:ring-accent"
                  />
                  <span className="text-sm font-medium text-primary-800">{user.name}</span>
                  <span className="text-xs text-primary-400">{user.email}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowAssign(null); setSelectedUsers([]); }} className="flex-1 h-10 border border-primary-200 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-50">Cancel</button>
              <button data-testid="assign-submit-button" onClick={handleAssign} className="flex-1 h-10 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-600">Assign</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminJobsPage;
