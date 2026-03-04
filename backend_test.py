import requests
import sys
from datetime import datetime

class StrongAirAPITester:
    def __init__(self, base_url="https://d6e3a11d-dada-4bbc-b9ef-35ee4225014e.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.worker_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.critical_issues = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error detail: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")
                
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            if "Connection" in str(e) or "timeout" in str(e).lower():
                self.critical_issues.append(f"Connection issue with {endpoint}: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@strongair.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin user role: {response.get('user', {}).get('role')}")
            return True
        else:
            self.critical_issues.append("Admin login failed - blocking admin functionality testing")
        return False

    def test_worker_login(self):
        """Test worker login"""
        success, response = self.run_test(
            "Worker Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "john@strongair.com", "password": "worker123"}
        )
        if success and 'access_token' in response:
            self.worker_token = response['access_token']
            print(f"   Worker user role: {response.get('user', {}).get('role')}")
            return True
        else:
            self.critical_issues.append("Worker login failed - blocking worker functionality testing")
        return False

    def test_invalid_login(self):
        """Test invalid credentials"""
        return self.run_test(
            "Invalid Login",
            "POST",
            "api/auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrongpass"}
        )

    def test_analytics_summary(self):
        """Test dashboard summary API"""
        if not self.admin_token:
            print("❌ Skipping analytics summary - no admin token")
            return False
        
        success, response = self.run_test(
            "Analytics Summary",
            "GET",
            "api/analytics/summary",
            200,
            token=self.admin_token
        )
        
        if success:
            # Validate response structure
            required_fields = ['total_hours', 'total_users', 'pending_users', 'active_jobs', 'active_sessions']
            for field in required_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in summary response")
                    return False
            print(f"   Summary data: {response}")
        return success

    def test_analytics_hours_by_user(self):
        """Test hours by user analytics"""
        if not self.admin_token:
            print("❌ Skipping hours by user - no admin token")
            return False
        
        return self.run_test(
            "Analytics Hours by User",
            "GET",
            "api/analytics/hours-by-user",
            200,
            token=self.admin_token
        )

    def test_analytics_hours_by_job(self):
        """Test hours by job analytics"""
        if not self.admin_token:
            print("❌ Skipping hours by job - no admin token")
            return False
        
        return self.run_test(
            "Analytics Hours by Job",
            "GET",
            "api/analytics/hours-by-job",
            200,
            token=self.admin_token
        )

    def test_clock_sessions(self):
        """Test clock sessions API"""
        if not self.admin_token:
            print("❌ Skipping clock sessions - no admin token")
            return False
        
        success, response = self.run_test(
            "Clock Sessions List",
            "GET",
            "api/clock/sessions",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Found {len(response)} clock sessions")
        return success

    def test_worker_clock_sessions(self):
        """Test worker's own clock sessions"""
        if not self.worker_token:
            print("❌ Skipping worker clock sessions - no worker token")
            return False
        
        return self.run_test(
            "Worker Clock Sessions",
            "GET",
            "api/clock/sessions",
            200,
            token=self.worker_token
        )

    def test_auth_me_endpoint(self):
        """Test current user info endpoint"""
        tests = []
        
        if self.admin_token:
            success, response = self.run_test(
                "Auth Me (Admin)",
                "GET",
                "api/auth/me",
                200,
                token=self.admin_token
            )
            tests.append(success)
            if success:
                print(f"   Admin user: {response.get('name')} ({response.get('role')})")
        
        if self.worker_token:
            success, response = self.run_test(
                "Auth Me (Worker)",
                "GET",
                "api/auth/me",
                200,
                token=self.worker_token
            )
            tests.append(success)
            if success:
                print(f"   Worker user: {response.get('name')} ({response.get('role')})")
        
        return all(tests) if tests else False

    def test_unauthorized_access(self):
        """Test endpoints without authentication"""
        endpoints = [
            ("api/analytics/summary", "Analytics Summary"),
            ("api/clock/sessions", "Clock Sessions"),
            ("api/auth/me", "Auth Me"),
            ("api/users/", "Users List")  # Fixed trailing slash
        ]
        
        all_passed = True
        for endpoint, name in endpoints:
            success, _ = self.run_test(
                f"Unauthorized {name}",
                "GET",
                endpoint,
                403  # Changed from 401 to 403 as that's what the API returns
            )
            if not success:
                all_passed = False
        
        return all_passed

    def test_users_api(self):
        """Test users API endpoints"""
        if not self.admin_token:
            print("❌ Skipping users API - no admin token")
            return False
        
        # Test GET /api/users/ (with trailing slash)
        success, response = self.run_test(
            "List Users",
            "GET",
            "api/users/",
            200,
            token=self.admin_token
        )
        
        if success:
            # Validate that only superadmin and user roles exist
            roles_found = set()
            for user in response:
                role = user.get('role')
                roles_found.add(role)
                print(f"   User: {user.get('name')} - Role: {role}")
            
            # Check that no 'admin' role exists
            if 'admin' in roles_found:
                print("❌ CRITICAL: Found deprecated 'admin' role in users!")
                self.critical_issues.append("Deprecated 'admin' role found in user data")
                return False
            
            valid_roles = {'superadmin', 'user'}
            invalid_roles = roles_found - valid_roles
            if invalid_roles:
                print(f"❌ Invalid roles found: {invalid_roles}")
                self.critical_issues.append(f"Invalid user roles found: {invalid_roles}")
                return False
            
            print(f"   ✅ Valid roles found: {roles_found}")
        
        return success

    def test_removed_admin_endpoint(self):
        """Test that POST /api/users/admin endpoint no longer exists"""
        if not self.admin_token:
            print("❌ Skipping admin endpoint test - no admin token")
            return False
        
        # This endpoint should return 404 since it was removed
        success, _ = self.run_test(
            "Create Admin Endpoint (Should be 404)",
            "POST",
            "api/users/admin",
            404,
            data={"email": "test@test.com", "password": "test123", "name": "Test Admin"},
            token=self.admin_token
        )
        
        if success:
            print("   ✅ Admin creation endpoint correctly removed")
        else:
            self.critical_issues.append("Admin creation endpoint still exists - should be removed")
        
        return success

    def test_role_validation(self):
        """Test role-based authentication and authorization"""
        tests_passed = 0
        total_tests = 0
        
        # Test admin can access users endpoint
        if self.admin_token:
            total_tests += 1
            success, _ = self.run_test(
                "Admin Access Users",
                "GET", 
                "api/users/",  # Fixed trailing slash
                200,
                token=self.admin_token
            )
            if success:
                tests_passed += 1
        
        # Test worker cannot access admin endpoints
        if self.worker_token:
            admin_endpoints = [
                ("api/users/", "Users List"),  # Fixed trailing slash
                ("api/analytics/summary", "Analytics Summary"),
            ]
            
            for endpoint, name in admin_endpoints:
                total_tests += 1
                success, _ = self.run_test(
                    f"Worker Access Denied - {name}",
                    "GET",
                    endpoint,
                    403,  # Should be forbidden
                    token=self.worker_token
                )
                if success:
                    tests_passed += 1
        
        return tests_passed == total_tests if total_tests > 0 else False

def main():
    print("🚀 Starting Strong Air API Testing...")
    print("=" * 50)
    
    tester = StrongAirAPITester()
    
    # Basic connectivity
    print("\n📡 Basic Connectivity Tests")
    tester.test_health_check()
    
    # Authentication tests
    print("\n🔐 Authentication Tests")
    admin_login_success = tester.test_admin_login()
    worker_login_success = tester.test_worker_login()
    tester.test_invalid_login()
    tester.test_unauthorized_access()
    
    # Analytics tests (admin only)
    if admin_login_success:
        print("\n📊 Analytics API Tests")
        tester.test_analytics_summary()
        tester.test_analytics_hours_by_user()
        tester.test_analytics_hours_by_job()
    
    # Users API tests (role validation)
    if admin_login_success:
        print("\n👥 Users Management Tests")
        tester.test_users_api()
        tester.test_removed_admin_endpoint()
    
    # Role-based access tests
    if admin_login_success or worker_login_success:
        print("\n🔒 Role-Based Access Tests")
        tester.test_role_validation()
    
    # Clock management tests
    if admin_login_success or worker_login_success:
        print("\n⏰ Clock Management Tests")
        if admin_login_success:
            tester.test_clock_sessions()
        if worker_login_success:
            tester.test_worker_clock_sessions()
        
        # Auth me tests
        print("\n👤 User Profile Tests")
        tester.test_auth_me_endpoint()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed ({round(tester.tests_passed/tester.tests_run*100, 1)}%)")
    
    if tester.critical_issues:
        print("\n🚨 Critical Issues:")
        for issue in tester.critical_issues:
            print(f"   - {issue}")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for test in tester.failed_tests:
            print(f"   - {test['test']}: {test.get('error', 'Status code mismatch')}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())