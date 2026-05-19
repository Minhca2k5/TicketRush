package com.ticketrush.eventservice.realtime;

import java.util.List;

public record SeatMapRealtimeMessage(
        String type,
        Long eventId,
        String reason,
        List<Long> changedSeatIds,
        String timestamp
) {
}
