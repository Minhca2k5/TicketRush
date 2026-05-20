package com.ticketrush.bookingservice.dto;

import com.ticketrush.bookingservice.entity.Notification;
import lombok.Data;

import java.time.Instant;

@Data
public class NotificationDTO {
    private Long id;
    private String userId;
    private String type;
    private String title;
    private String message;
    private String actionUrl;
    private Long eventId;
    private Long seatId;
    private boolean read;
    private Instant createdAt;
    private Instant readAt;

    public static NotificationDTO fromEntity(Notification notification) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(notification.getId());
        dto.setUserId(notification.getUserId());
        dto.setType(notification.getType());
        dto.setTitle(notification.getTitle());
        dto.setMessage(notification.getMessage());
        dto.setActionUrl(notification.getActionUrl());
        dto.setEventId(notification.getEventId());
        dto.setSeatId(notification.getSeatId());
        dto.setRead(notification.isRead());
        dto.setCreatedAt(notification.getCreatedAt());
        dto.setReadAt(notification.getReadAt());
        return dto;
    }
}
