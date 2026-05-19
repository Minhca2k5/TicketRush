package com.ticketrush.bookingservice.config;

import com.ticketrush.bookingservice.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UpcomingEventNotificationScheduler {

    private final NotificationService notificationService;

    @Value("${app.notifications.upcoming.enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${app.notifications.upcoming.delay-ms:600000}")
    public void createUpcomingEventNotifications() {
        if (!enabled) {
            return;
        }
        notificationService.createUpcomingEventNotificationsForAllUsers();
    }
}
