package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventReviewSummaryDTO {
    private Long eventId;
    private double averageRating;
    private long reviewCount;
}
