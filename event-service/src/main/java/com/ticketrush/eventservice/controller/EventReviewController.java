package com.ticketrush.eventservice.controller;

import com.ticketrush.eventservice.dto.ApiResponse;
import com.ticketrush.eventservice.dto.EventReviewDTO;
import com.ticketrush.eventservice.dto.EventReviewRequestDTO;
import com.ticketrush.eventservice.dto.EventReviewSummaryDTO;
import com.ticketrush.eventservice.service.EventReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events/{eventId}/reviews")
@RequiredArgsConstructor
public class EventReviewController {
    private final EventReviewService reviewService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EventReviewDTO>>> getReviews(@PathVariable Long eventId) {
        return ResponseEntity.ok(ApiResponse.success("Reviews fetched successfully", reviewService.getReviews(eventId)));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<EventReviewSummaryDTO>> getSummary(@PathVariable Long eventId) {
        return ResponseEntity.ok(ApiResponse.success("Review summary fetched successfully", reviewService.getSummary(eventId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EventReviewDTO>> submitReview(
            @PathVariable Long eventId,
            @RequestBody EventReviewRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Review submitted successfully", reviewService.submitReview(eventId, request)));
    }
}
