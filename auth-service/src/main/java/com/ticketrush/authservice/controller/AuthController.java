package com.ticketrush.authservice.controller;

import com.ticketrush.authservice.dto.ApiResponse;
import com.ticketrush.authservice.dto.AuthDashboardResponse;
import com.ticketrush.authservice.dto.LoginResponse;
import com.ticketrush.authservice.dto.UserResponse;
import com.ticketrush.authservice.model.User;
import com.ticketrush.authservice.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(@Valid @RequestBody User user) {
        User savedUser = authService.register(user);
        return ResponseEntity.ok(ApiResponse.success(new UserResponse(savedUser)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@RequestBody LoginRequest request) {
        String token = authService.login(request.getUsername(), request.getPassword());
        return ResponseEntity.ok(ApiResponse.success(new LoginResponse(token)));
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> getProfile(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        User user = authService.getProfile(token);
        return ResponseEntity.ok(ApiResponse.success(new UserResponse(user)));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(@RequestHeader("Authorization") String authHeader, @RequestBody User updates) {
        String token = authHeader.replace("Bearer ", "");
        User updatedUser = authService.updateProfile(token, updates);
        return ResponseEntity.ok(ApiResponse.success(new UserResponse(updatedUser)));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AuthDashboardResponse>> getDashboardSummary() {
        return ResponseEntity.ok(ApiResponse.success(authService.getDashboardSummary()));
    }

    public static class LoginRequest {
        private String username;
        private String password;

        // Getters and setters
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
}
