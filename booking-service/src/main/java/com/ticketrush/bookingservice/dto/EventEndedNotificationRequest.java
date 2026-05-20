package com.ticketrush.bookingservice.dto;

import lombok.Data;

@Data
public class EventEndedNotificationRequest {
    private Long eventId;
    private String eventName;
}
