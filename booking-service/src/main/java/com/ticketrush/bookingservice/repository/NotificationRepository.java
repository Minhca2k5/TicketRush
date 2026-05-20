package com.ticketrush.bookingservice.repository;

import com.ticketrush.bookingservice.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    long countByUserIdAndReadFalse(String userId);

    Optional<Notification> findByIdAndUserId(Long id, String userId);

    Optional<Notification> findByUserIdAndDedupeKey(String userId, String dedupeKey);

    void deleteByUserId(String userId);
}
