package com.ticketrush.eventservice.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SeatMapRealtimePublisher {

    private final SeatMapWebSocketHandler webSocketHandler;

    public void publishSeatMapChanged(Long eventId, String reason, List<Long> changedSeatIds) {
        if (eventId == null) {
            return;
        }

        Runnable broadcast = () -> webSocketHandler.broadcastSeatMapChanged(eventId, reason, changedSeatIds);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    broadcast.run();
                }
            });
            return;
        }

        broadcast.run();
    }
}
