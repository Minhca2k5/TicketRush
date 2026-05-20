package com.ticketrush.authservice.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(unique = true)
    private String username;

    @NotBlank
    private String password;

    @Email
    @NotBlank
    private String email;

    @Column(nullable = false)
    private boolean emailVerified;

    private String verificationCode;

    private Instant verificationCodeExpiresAt;

    @Column(nullable = false)
    private int verificationFailedAttempts;

    @Enumerated(EnumType.STRING)
    private Role role;

    private Integer age;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getVerificationCode() { return verificationCode; }
    public void setVerificationCode(String verificationCode) { this.verificationCode = verificationCode; }

    public Instant getVerificationCodeExpiresAt() { return verificationCodeExpiresAt; }
    public void setVerificationCodeExpiresAt(Instant verificationCodeExpiresAt) { this.verificationCodeExpiresAt = verificationCodeExpiresAt; }

    public int getVerificationFailedAttempts() { return verificationFailedAttempts; }
    public void setVerificationFailedAttempts(int verificationFailedAttempts) { this.verificationFailedAttempts = verificationFailedAttempts; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public Gender getGender() { return gender; }
    public void setGender(Gender gender) { this.gender = gender; }

    public enum Role {
        CUSTOMER, ADMIN
    }

    public enum Gender {
        M, F
    }
}
