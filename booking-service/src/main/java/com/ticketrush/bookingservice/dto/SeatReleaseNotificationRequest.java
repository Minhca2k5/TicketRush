package com.ticketrush.bookingservice.dto;

import lombok.Data;

@Data
public class SeatReleaseNotificationRequest {
    private String userId;
    private Long eventId;
    private SeatDTO seat;
}
