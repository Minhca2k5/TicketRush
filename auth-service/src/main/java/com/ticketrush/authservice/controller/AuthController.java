package com.ticketrush.authservice.controller;

import com.ticketrush.authservice.dto.ApiResponse;
import com.ticketrush.authservice.dto.AuthDashboardResponse;
import com.ticketrush.authservice.dto.AuthSettingsResponse;
import com.ticketrush.authservice.dto.LoginResponse;
import com.ticketrush.authservice.dto.UserResponse;
import com.ticketrush.authservice.exception.AuthServiceException;
import com.ticketrush.authservice.model.User;
import com.ticketrush.authservice.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        String token = extractBearerToken(authHeader);
        User user = authService.getProfile(token);
        return ResponseEntity.ok(ApiResponse.success(new UserResponse(user)));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(@RequestHeader("Authorization") String authHeader, @RequestBody User updates) {
        String token = extractBearerToken(authHeader);
        User updatedUser = authService.updateProfile(token, updates);
        return ResponseEntity.ok(ApiResponse.success(new UserResponse(updatedUser)));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AuthDashboardResponse>> getDashboardSummary(@RequestHeader("Authorization") String authHeader) {
        authService.requireAdmin(extractBearerToken(authHeader));
        return ResponseEntity.ok(ApiResponse.success(authService.getDashboardSummary()));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getUsers(@RequestHeader("Authorization") String authHeader) {
        authService.requireAdmin(extractBearerToken(authHeader));
        List<UserResponse> users = authService.getUsers().stream()
                .map(UserResponse::new)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<AuthSettingsResponse>> getSettings(@RequestHeader("Authorization") String authHeader) {
        authService.requireAdmin(extractBearerToken(authHeader));
        return ResponseEntity.ok(ApiResponse.success(authService.getSettings()));
    }

    private String extractBearerToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }
        return authHeader.substring(7);
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
