package com.ticketrush.authservice.service;

import com.ticketrush.authservice.model.PendingRegistration;
import com.ticketrush.authservice.model.User;
import com.ticketrush.authservice.repository.PendingRegistrationRepository;
import com.ticketrush.authservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private UserRepository userRepository;
    private PendingRegistrationRepository pendingRegistrationRepository;
    private EmailService emailService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        pendingRegistrationRepository = mock(PendingRegistrationRepository.class);
        emailService = mock(EmailService.class);
        authService = new AuthService(userRepository, pendingRegistrationRepository, emailService);
        ReflectionTestUtils.setField(authService, "verificationCodeTtlMinutes", 1L);
        ReflectionTestUtils.setField(authService, "verificationMaxFailedAttempts", 5);
    }

    @Test
    void registerStoresPendingRegistrationInsteadOfUser() {
        User request = new User();
        request.setUsername("alice");
        request.setPassword("plain-password");
        request.setEmail("Alice@Example.com");

        when(emailService.normalizeAndValidateRecipient("Alice@Example.com")).thenReturn("alice@example.com");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(pendingRegistrationRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(pendingRegistrationRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(pendingRegistrationRepository.save(any(PendingRegistration.class))).thenAnswer(invocation -> {
            PendingRegistration pending = invocation.getArgument(0);
            pending.setId(10L);
            return pending;
        });

        User pendingUser = authService.register(request);

        assertThat(pendingUser.getId()).isNull();
        assertThat(pendingUser.getEmail()).isEqualTo("alice@example.com");
        assertThat(pendingUser.isEmailVerified()).isFalse();
        verify(userRepository, never()).save(any(User.class));
        verify(pendingRegistrationRepository).save(org.mockito.ArgumentMatchers.argThat(pending ->
                pending.getEmail().equals("alice@example.com")
                        && pending.getUsername().equals("alice")
                        && !pending.getPasswordHash().equals("plain-password")
                        && pending.getVerificationCode() != null
        ));
        verify(emailService).sendOtp(eq("alice@example.com"), eq("alice"), any(String.class), eq(1L), eq(5));
    }

    @Test
    void verifyEmailCreatesUserAndDeletesPendingRegistration() {
        PendingRegistration pending = new PendingRegistration();
        pending.setId(10L);
        pending.setUsername("alice");
        pending.setEmail("alice@example.com");
        pending.setPasswordHash("$2a$hash");
        pending.setVerificationCode("123456");
        pending.setVerificationCodeExpiresAt(Instant.now().plusSeconds(60));

        when(pendingRegistrationRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(pending));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());

        authService.verifyEmail("Alice@Example.com", "123456");

        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(user ->
                user.getUsername().equals("alice")
                        && user.getEmail().equals("alice@example.com")
                        && user.getPassword().equals("$2a$hash")
                        && user.getRole() == User.Role.CUSTOMER
                        && user.isEmailVerified()
        ));
        verify(pendingRegistrationRepository).delete(pending);
    }
}
