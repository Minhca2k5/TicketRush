package com.ticketrush.authservice.repository;

import com.ticketrush.authservice.model.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, Long> {
    Optional<PendingRegistration> findByUsername(String username);
    Optional<PendingRegistration> findByEmail(String email);
}
