package com.ticketrush.bookingservice.controller;

import com.ticketrush.bookingservice.dto.ApiResponse;
import com.ticketrush.bookingservice.dto.EventEndedNotificationRequest;
import com.ticketrush.bookingservice.dto.NotificationDTO;
import com.ticketrush.bookingservice.dto.SeatReleaseNotificationRequest;
import com.ticketrush.bookingservice.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/booking/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/internal/event-ended")
    public ResponseEntity<ApiResponse<Void>> createEventEndedNotification(
            @RequestBody EventEndedNotificationRequest request
    ) {
        notificationService.createEventEndedNotificationsForAllAttendees(
                request.getEventId(),
                request.getEventName()
        );
        return ResponseEntity.ok(ApiResponse.success("Event ended notifications created", null));
    }

    @PostMapping("/internal/seat-released")
    public ResponseEntity<ApiResponse<Void>> createSeatReleasedNotification(
            @RequestBody SeatReleaseNotificationRequest request
    ) {
        notificationService.createSeatReleasedNotification(
                request.getUserId(),
                request.getEventId(),
                request.getSeat()
        );
        return ResponseEntity.ok(ApiResponse.success("Seat release notification created", null));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<List<NotificationDTO>>> getNotifications(@PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Notifications fetched successfully",
                notificationService.getUserNotifications(userId)
        ));
    }

    @GetMapping("/{userId}/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount(@PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Unread notification count fetched successfully",
                Map.of("count", notificationService.getUnreadCount(userId))
        ));
    }

    @PatchMapping("/{userId}/{id}/read")
    public ResponseEntity<ApiResponse<NotificationDTO>> markAsRead(@PathVariable String userId, @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Notification marked as read",
                notificationService.markAsRead(userId, id)
        ));
    }

    @PatchMapping("/{userId}/read-all")
    public ResponseEntity<ApiResponse<List<NotificationDTO>>> markAllAsRead(@PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Notifications marked as read",
                notificationService.markAllAsRead(userId)
        ));
    }

    @DeleteMapping("/{userId}/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteNotification(@PathVariable String userId, @PathVariable Long id) {
        notificationService.deleteNotification(userId, id);
        return ResponseEntity.ok(ApiResponse.success("Notification deleted", null));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<ApiResponse<Void>> clearNotifications(@PathVariable String userId) {
        notificationService.clearUserNotifications(userId);
        return ResponseEntity.ok(ApiResponse.success("Notifications cleared", null));
    }
}
