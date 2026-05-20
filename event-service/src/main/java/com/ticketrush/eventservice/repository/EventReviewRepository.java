package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.EventReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EventReviewRepository extends JpaRepository<EventReview, Long> {
    List<EventReview> findByEventIdOrderByCreatedAtDesc(Long eventId);

    Optional<EventReview> findByEventIdAndUserId(Long eventId, String userId);

    long countByEventId(Long eventId);

    @Query("select coalesce(avg(r.rating), 0) from EventReview r where r.event.id = :eventId")
    Double getAverageRatingByEventId(Long eventId);
}
