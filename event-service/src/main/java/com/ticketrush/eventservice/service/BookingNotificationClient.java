package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.SeatDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BookingNotificationClient {

    private final RestTemplate restTemplate;

    @Value("${app.booking-service-url}")
    private String bookingServiceUrl;

    public void notifySeatReleased(
            String userId,
            Long eventId,
            Long seatId,
            String seatNumber,
            String rowName,
            LocalDateTime lockExpiresAt
    ) {
        if (isBlank(userId) || eventId == null || seatId == null) {
            return;
        }

        SeatDTO seat = new SeatDTO();
        seat.setId(seatId);
        seat.setSeatNumber(seatNumber);
        seat.setRowName(rowName);
        seat.setLockExpiresAt(lockExpiresAt);

        Map<String, Object> payload = Map.of(
                "userId", userId,
                "eventId", eventId,
                "seat", seat
        );

        try {
            restTemplate.postForEntity(
                    bookingServiceUrl + "/api/booking/notifications/internal/seat-released",
                    payload,
                    Void.class
            );
        } catch (RestClientException ignored) {
            // Notification delivery should not block seat release cleanup.
        }
    }

    public void notifyEventEnded(Long eventId, String eventName) {
        if (eventId == null) {
            return;
        }

        Map<String, Object> payload = Map.of(
                "eventId", eventId,
                "eventName", eventName != null ? eventName : ""
        );

        try {
            restTemplate.postForEntity(
                    bookingServiceUrl + "/api/booking/notifications/internal/event-ended",
                    payload,
                    Void.class
            );
        } catch (RestClientException ignored) {
            // Notification delivery failure shouldn't fail event state advancement.
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
