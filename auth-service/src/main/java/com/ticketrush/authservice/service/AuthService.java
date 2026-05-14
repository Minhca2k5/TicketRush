package com.ticketrush.authservice.service;

import com.ticketrush.authservice.model.User;
import com.ticketrush.authservice.dto.AuthDashboardResponse;
import com.ticketrush.authservice.dto.AuthSettingsResponse;
import com.ticketrush.authservice.exception.AuthServiceException;
import com.ticketrush.authservice.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration:86400000}")
    private long jwtExpirationMs;

    @Value("${app.seed.admin.username:admin}")
    private String seededAdminUsername;

    @Value("${app.seed.admin.email:admin@ticketrush.local}")
    private String seededAdminEmail;

    @Value("${app.verification.code-ttl-minutes:1}")
    private long verificationCodeTtlMinutes;

    @Value("${app.verification.max-failed-attempts:5}")
    private int verificationMaxFailedAttempts;

    public AuthService(UserRepository userRepository, EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    public User register(User user) {
        logger.info("Registering user: {}", user.getUsername());
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            logger.warn("Username already exists: {}", user.getUsername());
            throw new AuthServiceException(HttpStatus.CONFLICT, "Username already exists");
        }

        String normalizedEmail = emailService.normalizeAndValidateRecipient(user.getEmail());

        User existingEmailUser = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (existingEmailUser != null) {
            if (existingEmailUser.isEmailVerified()) {
                logger.warn("Email already exists: {}", normalizedEmail);
                throw new AuthServiceException(HttpStatus.CONFLICT, "Email already exists");
            }

            logger.info("Email {} is pending verification. Sending a new code.", normalizedEmail);
            String previousCode = existingEmailUser.getVerificationCode();
            Instant previousExpiry = existingEmailUser.getVerificationCodeExpiresAt();
            int previousAttempts = existingEmailUser.getVerificationFailedAttempts();
            refreshVerificationCode(existingEmailUser);
            User saved = userRepository.save(existingEmailUser);
            try {
                sendVerificationEmail(saved.getEmail(), saved.getUsername(), saved.getVerificationCode());
            } catch (RuntimeException exception) {
                logger.error("Failed to send verification email to {}", saved.getEmail(), exception);
                existingEmailUser.setVerificationCode(previousCode);
                existingEmailUser.setVerificationCodeExpiresAt(previousExpiry);
                existingEmailUser.setVerificationFailedAttempts(previousAttempts);
                userRepository.save(existingEmailUser);
                throw new AuthServiceException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send verification email");
            }
            return saved;
        }

        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole(User.Role.CUSTOMER);
        user.setEmailVerified(false);
        refreshVerificationCode(user);
        User saved = userRepository.save(user);
        try {
            sendVerificationEmail(saved.getEmail(), saved.getUsername(), saved.getVerificationCode());
        } catch (RuntimeException exception) {
            logger.error("Failed to send verification email to {}", saved.getEmail(), exception);
            userRepository.deleteById(saved.getId());
            throw new AuthServiceException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send verification email");
        }
        logger.info("User pending email verification: {}", saved.getId());
        return saved;
    }

    public void verifyEmail(String email, String code) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AuthServiceException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.isEmailVerified()) {
            return;
        }

        if (user.getVerificationCode() == null || user.getVerificationCodeExpiresAt() == null) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Verification code expired. Please resend the code.");
        }

        if (Instant.now().isAfter(user.getVerificationCodeExpiresAt())) {
            clearVerificationCode(user);
            userRepository.save(user);
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Verification code expired. Please resend the code.");
        }

        if (user.getVerificationFailedAttempts() >= verificationMaxFailedAttempts) {
            clearVerificationCode(user);
            userRepository.save(user);
            throw new AuthServiceException(HttpStatus.TOO_MANY_REQUESTS, "Too many invalid attempts. Please resend the verification code.");
        }

        if (!user.getVerificationCode().equals(code)) {
            int attempts = user.getVerificationFailedAttempts() + 1;
            user.setVerificationFailedAttempts(attempts);

            if (attempts >= verificationMaxFailedAttempts) {
                clearVerificationCode(user);
                userRepository.save(user);
                throw new AuthServiceException(HttpStatus.TOO_MANY_REQUESTS, "Too many invalid attempts. Please resend the verification code.");
            }

            userRepository.save(user);
            int remainingAttempts = verificationMaxFailedAttempts - attempts;
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Invalid verification code. " + remainingAttempts + " attempts remaining.");
        }

        user.setEmailVerified(true);
        clearVerificationCode(user);
        userRepository.save(user);
    }

    public void resendVerificationCode(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AuthServiceException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.isEmailVerified()) {
            throw new AuthServiceException(HttpStatus.CONFLICT, "Email is already verified");
        }

        String previousCode = user.getVerificationCode();
        Instant previousExpiry = user.getVerificationCodeExpiresAt();
        int previousAttempts = user.getVerificationFailedAttempts();
        refreshVerificationCode(user);
        userRepository.save(user);
        try {
            sendVerificationEmail(user.getEmail(), user.getUsername(), user.getVerificationCode());
        } catch (RuntimeException exception) {
            logger.error("Failed to resend verification email to {}", user.getEmail(), exception);
            user.setVerificationCode(previousCode);
            user.setVerificationCodeExpiresAt(previousExpiry);
            user.setVerificationFailedAttempts(previousAttempts);
            userRepository.save(user);
            throw new AuthServiceException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send verification email");
        }
    }

    public String login(String username, String password) {
        logger.info("Login attempt for user: {}", username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AuthServiceException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        if (!passwordEncoder.matches(password, user.getPassword())) {
            logger.warn("Invalid password for user: {}", username);
            throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        if (!user.isEmailVerified()) {
            throw new AuthServiceException(HttpStatus.FORBIDDEN, "Email not verified. Please check your inbox and verify your account.");
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
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(key)
                .compact();
    }

    private String generateVerificationCode() {
        int code = 100000 + SECURE_RANDOM.nextInt(900000);
        return String.valueOf(code);
    }

    private void refreshVerificationCode(User user) {
        user.setVerificationCode(generateVerificationCode());
        user.setVerificationCodeExpiresAt(Instant.now().plusSeconds(verificationCodeTtlMinutes * 60));
        user.setVerificationFailedAttempts(0);
    }

    private void clearVerificationCode(User user) {
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
        user.setVerificationFailedAttempts(0);
    }

    private void sendVerificationEmail(String email, String username, String verificationCode) {
        emailService.sendOtp(email, username, verificationCode, verificationCodeTtlMinutes, verificationMaxFailedAttempts);
    }

    public Long validateToken(String token) {
        try {
            Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            return Long.parseLong(Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().getSubject());
        } catch (Exception e) {
            throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }
    }

    public User getProfile(String token) {
        Long userId = validateToken(token);
        logger.info("Getting profile for user: {}", userId);
        return userRepository.findById(userId)
                .orElseThrow(() -> new AuthServiceException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public User updateProfile(String token, User updates) {
        Long userId = validateToken(token);
        logger.info("Updating profile for user: {}", userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthServiceException(HttpStatus.NOT_FOUND, "User not found"));
        if (updates.getEmail() != null && userRepository.findByEmail(updates.getEmail())
                .filter(existing -> !existing.getId().equals(userId))
                .isPresent()) {
            throw new AuthServiceException(HttpStatus.CONFLICT, "Email already exists");
        }
        if (updates.getEmail() != null) user.setEmail(updates.getEmail());
        if (updates.getAge() != null) user.setAge(updates.getAge());
        if (updates.getGender() != null) user.setGender(updates.getGender());
        User saved = userRepository.save(user);
        logger.info("Profile updated for user: {}", userId);
        return saved;
    }

    public void requireAdmin(String token) {
        User user = getProfile(token);
        if (user.getRole() != User.Role.ADMIN) {
            throw new AuthServiceException(HttpStatus.FORBIDDEN, "Admin role required");
        }
    }

    public List<User> getUsers() {
        return userRepository.findAll();
    }

    public AuthSettingsResponse getSettings() {
        return new AuthSettingsResponse(
                "auth-service",
                jwtExpirationMs,
                seededAdminUsername,
                seededAdminEmail,
                "BCrypt"
        );
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
