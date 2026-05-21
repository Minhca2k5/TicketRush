package com.ticketrush.authservice.service;

import com.ticketrush.authservice.model.User;
import com.ticketrush.authservice.dto.AuthDashboardResponse;
import com.ticketrush.authservice.dto.AuthSettingsResponse;
import com.ticketrush.authservice.exception.AuthServiceException;
import com.ticketrush.authservice.model.PendingRegistration;
import com.ticketrush.authservice.repository.PendingRegistrationRepository;
import com.ticketrush.authservice.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final PendingRegistrationRepository pendingRegistrationRepository;
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

    public AuthService(
            UserRepository userRepository,
            PendingRegistrationRepository pendingRegistrationRepository,
            EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.pendingRegistrationRepository = pendingRegistrationRepository;
        this.emailService = emailService;
    }

    @Transactional
    public User register(User user) {
        String username = required(user.getUsername(), "Username is required");
        logger.info("Registering user: {}", username);
        if (userRepository.findByUsername(username).isPresent()) {
            logger.warn("Username already exists: {}", username);
            throw new AuthServiceException(HttpStatus.CONFLICT, "Username already exists");
        }

        String normalizedEmail = emailService.normalizeAndValidateRecipient(user.getEmail());
        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            logger.warn("Email already exists: {}", normalizedEmail);
            throw new AuthServiceException(HttpStatus.CONFLICT, "Email already exists");
        }

        PendingRegistration pendingRegistration = resolvePendingRegistration(username, normalizedEmail);
        pendingRegistration.setUsername(username);
        pendingRegistration.setEmail(normalizedEmail);
        pendingRegistration.setPasswordHash(passwordEncoder.encode(user.getPassword()));
        pendingRegistration.setAge(user.getAge());
        pendingRegistration.setGender(user.getGender());
        refreshVerificationCode(pendingRegistration);

        PendingRegistration saved = pendingRegistrationRepository.save(pendingRegistration);
        try {
            sendVerificationEmail(saved.getEmail(), saved.getUsername(), saved.getVerificationCode());
        } catch (RuntimeException exception) {
            logger.error("Failed to send verification email to {}", saved.getEmail(), exception);
            throw new AuthServiceException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send verification email");
        }
        logger.info("Registration pending email verification: {}", saved.getId());
        return toPendingUser(saved);
    }

    @Transactional
    public void verifyEmail(String email, String code) {
        String normalizedEmail = normalizeEmailForLookup(email);
        PendingRegistration pendingRegistration = pendingRegistrationRepository.findByEmail(normalizedEmail)
                .orElse(null);

        if (pendingRegistration == null) {
            User existingUser = userRepository.findByEmail(normalizedEmail).orElse(null);
            if (existingUser != null && existingUser.isEmailVerified()) {
                return;
            }
            throw new AuthServiceException(HttpStatus.NOT_FOUND, "Pending registration not found");
        }

        if (pendingRegistration.getVerificationCode() == null || pendingRegistration.getVerificationCodeExpiresAt() == null) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Verification code expired. Please resend the code.");
        }

        if (Instant.now().isAfter(pendingRegistration.getVerificationCodeExpiresAt())) {
            clearVerificationCode(pendingRegistration);
            pendingRegistrationRepository.save(pendingRegistration);
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Verification code expired. Please resend the code.");
        }

        if (pendingRegistration.getVerificationFailedAttempts() >= verificationMaxFailedAttempts) {
            clearVerificationCode(pendingRegistration);
            pendingRegistrationRepository.save(pendingRegistration);
            throw new AuthServiceException(HttpStatus.TOO_MANY_REQUESTS, "Too many invalid attempts. Please resend the verification code.");
        }

        if (!pendingRegistration.getVerificationCode().equals(code == null ? "" : code.trim())) {
            int attempts = pendingRegistration.getVerificationFailedAttempts() + 1;
            pendingRegistration.setVerificationFailedAttempts(attempts);

            if (attempts >= verificationMaxFailedAttempts) {
                clearVerificationCode(pendingRegistration);
                pendingRegistrationRepository.save(pendingRegistration);
                throw new AuthServiceException(HttpStatus.TOO_MANY_REQUESTS, "Too many invalid attempts. Please resend the verification code.");
            }

            pendingRegistrationRepository.save(pendingRegistration);
            int remainingAttempts = verificationMaxFailedAttempts - attempts;
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Invalid verification code. " + remainingAttempts + " attempts remaining.");
        }

        if (userRepository.findByUsername(pendingRegistration.getUsername()).isPresent()) {
            throw new AuthServiceException(HttpStatus.CONFLICT, "Username already exists");
        }
        if (userRepository.findByEmail(pendingRegistration.getEmail()).isPresent()) {
            throw new AuthServiceException(HttpStatus.CONFLICT, "Email already exists");
        }

        User user = new User();
        user.setUsername(pendingRegistration.getUsername());
        user.setEmail(pendingRegistration.getEmail());
        user.setPassword(pendingRegistration.getPasswordHash());
        user.setRole(User.Role.CUSTOMER);
        user.setEmailVerified(true);
        user.setAge(pendingRegistration.getAge());
        user.setGender(pendingRegistration.getGender());
        userRepository.save(user);
        pendingRegistrationRepository.delete(pendingRegistration);
    }

    @Transactional
    public void resendVerificationCode(String email) {
        String normalizedEmail = normalizeEmailForLookup(email);
        PendingRegistration pendingRegistration = pendingRegistrationRepository.findByEmail(normalizedEmail)
                .orElse(null);

        if (pendingRegistration == null) {
            User existingUser = userRepository.findByEmail(normalizedEmail).orElse(null);
            if (existingUser != null && existingUser.isEmailVerified()) {
                throw new AuthServiceException(HttpStatus.CONFLICT, "Email is already verified");
            }
            throw new AuthServiceException(HttpStatus.NOT_FOUND, "Pending registration not found");
        }

        String previousCode = pendingRegistration.getVerificationCode();
        Instant previousExpiry = pendingRegistration.getVerificationCodeExpiresAt();
        int previousAttempts = pendingRegistration.getVerificationFailedAttempts();
        refreshVerificationCode(pendingRegistration);
        pendingRegistrationRepository.save(pendingRegistration);
        try {
            sendVerificationEmail(pendingRegistration.getEmail(), pendingRegistration.getUsername(), pendingRegistration.getVerificationCode());
        } catch (RuntimeException exception) {
            logger.error("Failed to resend verification email to {}", pendingRegistration.getEmail(), exception);
            pendingRegistration.setVerificationCode(previousCode);
            pendingRegistration.setVerificationCodeExpiresAt(previousExpiry);
            pendingRegistration.setVerificationFailedAttempts(previousAttempts);
            pendingRegistrationRepository.save(pendingRegistration);
            throw new AuthServiceException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send verification email");
        }
    }

    public String login(String username, String password) {
        String normalizedUsername = username == null ? "" : username.trim();
        logger.info("Login attempt for user: {}", normalizedUsername);
        User user = userRepository.findByUsername(normalizedUsername)
                .orElseThrow(() -> {
                    if (pendingRegistrationRepository.findByUsername(normalizedUsername).isPresent()) {
                        return new AuthServiceException(HttpStatus.FORBIDDEN, "Email not verified. Please check your inbox and verify your account.");
                    }
                    return new AuthServiceException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
                });
        if (!passwordEncoder.matches(password, user.getPassword())) {
            logger.warn("Invalid password for user: {}", normalizedUsername);
            throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        if (!user.isEmailVerified()) {
            throw new AuthServiceException(HttpStatus.FORBIDDEN, "Email not verified. Please check your inbox and verify your account.");
        }
        String token = generateToken(user);
        logger.info("Login successful for user: {}", normalizedUsername);
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

    private void refreshVerificationCode(PendingRegistration pendingRegistration) {
        pendingRegistration.setVerificationCode(generateVerificationCode());
        pendingRegistration.setVerificationCodeExpiresAt(Instant.now().plusSeconds(verificationCodeTtlMinutes * 60));
        pendingRegistration.setVerificationFailedAttempts(0);
    }

    private void clearVerificationCode(PendingRegistration pendingRegistration) {
        pendingRegistration.setVerificationCode(null);
        pendingRegistration.setVerificationCodeExpiresAt(null);
        pendingRegistration.setVerificationFailedAttempts(0);
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
        String normalizedEmail = updates.getEmail() == null ? null : emailService.normalizeAndValidateRecipient(updates.getEmail());
        if (normalizedEmail != null && userRepository.findByEmail(normalizedEmail)
                .filter(existing -> !existing.getId().equals(userId))
                .isPresent()) {
            throw new AuthServiceException(HttpStatus.CONFLICT, "Email already exists");
        }
        if (normalizedEmail != null) user.setEmail(normalizedEmail);
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

    private PendingRegistration resolvePendingRegistration(String username, String email) {
        PendingRegistration pendingByEmail = pendingRegistrationRepository.findByEmail(email).orElse(null);
        PendingRegistration pendingByUsername = pendingRegistrationRepository.findByUsername(username).orElse(null);

        if (pendingByEmail != null) {
            if (pendingByUsername != null && !pendingByUsername.getId().equals(pendingByEmail.getId())) {
                throw new AuthServiceException(HttpStatus.CONFLICT, "Username is pending email verification");
            }
            return pendingByEmail;
        }

        if (pendingByUsername != null) {
            if (!pendingByUsername.getEmail().equals(email)) {
                throw new AuthServiceException(HttpStatus.CONFLICT, "Username is pending email verification");
            }
            return pendingByUsername;
        }

        return new PendingRegistration();
    }

    private User toPendingUser(PendingRegistration pendingRegistration) {
        User user = new User();
        user.setUsername(pendingRegistration.getUsername());
        user.setEmail(pendingRegistration.getEmail());
        user.setRole(User.Role.CUSTOMER);
        user.setEmailVerified(false);
        user.setAge(pendingRegistration.getAge());
        user.setGender(pendingRegistration.getGender());
        return user;
    }

    private String normalizeEmailForLookup(String email) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isEmpty()) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        return normalizedEmail;
    }

    private String required(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }
}
