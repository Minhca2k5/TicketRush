package com.ticketrush.eventservice.config;

import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.realtime.SeatMapRealtimePublisher;
import com.ticketrush.eventservice.service.BookingNotificationClient;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class SeatLockReleaseScheduler {

    private final SeatRepository seatRepository;
    private final SeatMapRealtimePublisher seatMapRealtimePublisher;
    private final BookingNotificationClient bookingNotificationClient;

    @Value("${app.seat-lock.release.enabled:true}")
    private boolean releaseEnabled;

    @Scheduled(fixedDelayString = "${app.seat-lock.release.delay-ms:60000}")
    public void releaseLockedSeats() {
        if (!releaseEnabled) {
            return;
        }

        List<Seat> expiredLockedSeats = seatRepository.findByStatusAndLockExpiresAtBefore(
                "LOCKED",
                LocalDateTime.now()
        );
        if (expiredLockedSeats.isEmpty()) {
            return;
        }

        List<ExpiredSeatNotification> notifications = expiredLockedSeats.stream()
                .filter(seat -> seat.getLockHolder() != null && !seat.getLockHolder().isBlank())
                .filter(seat -> seat.getEvent() != null && seat.getEvent().getId() != null)
                .map(seat -> new ExpiredSeatNotification(
                        seat.getLockHolder(),
                        seat.getEvent().getId(),
                        seat.getId(),
                        seat.getSeatNumber(),
                        seat.getRowName(),
                        seat.getLockExpiresAt()
                ))
                .collect(Collectors.toList());

        expiredLockedSeats.forEach(seat -> {
            seat.setStatus("AVAILABLE");
            seat.setLockHolder(null);
            seat.setLockExpiresAt(null);
        });
        seatRepository.saveAll(expiredLockedSeats);

        expiredLockedSeats.stream()
                .filter(seat -> seat.getEvent() != null && seat.getEvent().getId() != null)
                .collect(Collectors.groupingBy(seat -> seat.getEvent().getId()))
                .forEach((eventId, seats) -> seatMapRealtimePublisher.publishSeatMapChanged(
                        eventId,
                        "LOCKS_EXPIRED",
                        seats.stream().map(Seat::getId).filter(Objects::nonNull).collect(Collectors.toList())
                ));

        notifications.forEach(notification -> bookingNotificationClient.notifySeatReleased(
                notification.userId(),
                notification.eventId(),
                notification.seatId(),
                notification.seatNumber(),
                notification.rowName(),
                notification.lockExpiresAt()
        ));
    }

    private record ExpiredSeatNotification(
            String userId,
            Long eventId,
            Long seatId,
            String seatNumber,
            String rowName,
            LocalDateTime lockExpiresAt
    ) {
    }
}
