package com.ticketrush.eventservice.config;

import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SeatLockReleaseScheduler {

    private final SeatRepository seatRepository;

    @Value("${app.seat-lock.release.enabled:true}")
    private boolean releaseEnabled;

    @Scheduled(fixedDelayString = "${app.seat-lock.release.delay-ms:60000}")
    public void releaseLockedSeats() {
        if (!releaseEnabled) {
            return;
        }

        List<Seat> lockedSeats = seatRepository.findByStatus("LOCKED");
        if (lockedSeats.isEmpty()) {
            return;
        }

        lockedSeats.forEach(seat -> seat.setStatus("AVAILABLE"));
        seatRepository.saveAll(lockedSeats);
    }
}
