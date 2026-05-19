package com.ticketrush.eventservice.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class EventReviewDTO {
    private Long id;
    private Long eventId;
    private String userId;
    private String userName;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
