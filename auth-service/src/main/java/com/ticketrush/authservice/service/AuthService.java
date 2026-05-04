package com.ticketrush.authservice.service;

import com.ticketrush.authservice.model.User;
import com.ticketrush.authservice.dto.AuthDashboardResponse;
import com.ticketrush.authservice.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.List;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${jwt.secret}")
    private String jwtSecret;

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User register(User user) {
        logger.info("Registering user: {}", user.getUsername());
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            logger.warn("Username already exists: {}", user.getUsername());
            throw new RuntimeException("Username already exists");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole(User.Role.CUSTOMER);
        User saved = userRepository.save(user);
        logger.info("User registered successfully: {}", saved.getId());
        return saved;
    }

    public String login(String username, String password) {
        logger.info("Login attempt for user: {}", username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!passwordEncoder.matches(password, user.getPassword())) {
            logger.warn("Invalid password for user: {}", username);
            throw new RuntimeException("Invalid password");
        }
        String token = generateToken(user);
        logger.info("Login successful for user: {}", username);
        return token;
    }

    private String generateToken(User user) {
        Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        return Jwts.builder()
                .setSubject(user.getId().toString())
                .claim("role", user.getRole())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 86400000)) // 24h
                .signWith(key)
                .compact();
    }

    public Long validateToken(String token) {
        try {
            Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            return Long.parseLong(Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().getSubject());
        } catch (Exception e) {
            throw new RuntimeException("Invalid token");
        }
    }

    public User getProfile(String token) {
        Long userId = validateToken(token);
        logger.info("Getting profile for user: {}", userId);
        return userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User updateProfile(String token, User updates) {
        Long userId = validateToken(token);
        logger.info("Updating profile for user: {}", userId);
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        if (updates.getEmail() != null) user.setEmail(updates.getEmail());
        if (updates.getAge() != null) user.setAge(updates.getAge());
        if (updates.getGender() != null) user.setGender(updates.getGender());
        User saved = userRepository.save(user);
        logger.info("Profile updated for user: {}", userId);
        return saved;
    }

    public AuthDashboardResponse getDashboardSummary() {
        List<User> users = userRepository.findAll();
        long adminCount = users.stream().filter(user -> user.getRole() == User.Role.ADMIN).count();
        long maleCount = users.stream().filter(user -> user.getGender() == User.Gender.M).count();
        long femaleCount = users.stream().filter(user -> user.getGender() == User.Gender.F).count();
        long completeProfiles = users.stream()
                .filter(user -> user.getAge() != null && user.getGender() != null)
                .count();
        double averageAge = users.stream()
                .filter(user -> user.getAge() != null)
                .mapToInt(User::getAge)
                .average()
                .orElse(0);

        AuthDashboardResponse response = new AuthDashboardResponse();
        response.setUserCount(users.size());
        response.setAdminCount(adminCount);
        response.setCustomerCount(users.size() - adminCount);
        response.setMaleCount(maleCount);
        response.setFemaleCount(femaleCount);
        response.setProfileCompletionCount(completeProfiles);
        response.setAverageAge(averageAge);
        return response;
    }
}
