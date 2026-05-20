package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.EventReviewDTO;
import com.ticketrush.eventservice.dto.EventReviewRequestDTO;
import com.ticketrush.eventservice.dto.EventReviewSummaryDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.EventReview;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.EventReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EventReviewService {
    private final EventRepository eventRepository;
    private final EventReviewRepository reviewRepository;

    @Transactional(readOnly = true)
    public List<EventReviewDTO> getReviews(Long eventId) {
        return reviewRepository.findByEventIdOrderByCreatedAtDesc(eventId).stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public EventReviewSummaryDTO getSummary(Long eventId) {
        return new EventReviewSummaryDTO(
                eventId,
                roundOneDecimal(reviewRepository.getAverageRatingByEventId(eventId)),
                reviewRepository.countByEventId(eventId)
        );
    }

    @Transactional
    public EventReviewDTO submitReview(Long eventId, EventReviewRequestDTO request) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found"));

        if (event.getEndTime() == null || event.getEndTime().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Reviews can only be submitted after the event has ended");
        }

        String userId = required(request.getUserId(), "User id is required");
        Integer rating = request.getRating();
        if (rating == null || rating < 1 || rating > 5) {
            throw new RuntimeException("Rating must be between 1 and 5");
        }

        EventReview review = reviewRepository.findByEventIdAndUserId(eventId, userId)
                .orElseGet(EventReview::new);
        review.setEvent(event);
        review.setUserId(userId);
        review.setUserName(defaultIfBlank(request.getUserName(), "TicketRush customer"));
        review.setRating(rating);
        review.setComment(trimToNull(request.getComment()));

        return mapToDTO(reviewRepository.save(review));
    }

    private EventReviewDTO mapToDTO(EventReview review) {
        EventReviewDTO dto = new EventReviewDTO();
        dto.setId(review.getId());
        dto.setEventId(review.getEvent() != null ? review.getEvent().getId() : null);
        dto.setUserId(review.getUserId());
        dto.setUserName(review.getUserName());
        dto.setRating(review.getRating());
        dto.setComment(review.getComment());
        dto.setCreatedAt(review.getCreatedAt());
        dto.setUpdatedAt(review.getUpdatedAt());
        return dto;
    }

    private double roundOneDecimal(Double value) {
        if (value == null) return 0;
        return Math.round(value * 10.0) / 10.0;
    }

    private String required(String value, String message) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new RuntimeException(message);
        }
        return normalized;
    }

    private String defaultIfBlank(String value, String defaultValue) {
        String normalized = trimToNull(value);
        return normalized != null ? normalized : defaultValue;
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
