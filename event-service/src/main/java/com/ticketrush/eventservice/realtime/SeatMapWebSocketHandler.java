package com.ticketrush.eventservice.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
@RequiredArgsConstructor
public class SeatMapWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<Long, Set<WebSocketSession>> sessionsByEventId = new ConcurrentHashMap<>();
    private final Map<String, Long> eventIdBySessionId = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long eventId = resolveEventId(session);
        if (eventId == null) {
            session.close(CloseStatus.BAD_DATA.withReason("Event id is required"));
            return;
        }

        sessionsByEventId.computeIfAbsent(eventId, ignored -> new CopyOnWriteArraySet<>()).add(session);
        eventIdBySessionId.put(session.getId(), eventId);

        send(session, new SeatMapRealtimeMessage("CONNECTED", eventId, "CONNECTED", List.of(), Instant.now().toString()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long eventId = eventIdBySessionId.remove(session.getId());
        if (eventId == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionsByEventId.get(eventId);
        if (sessions == null) {
            return;
        }

        sessions.remove(session);
        if (sessions.isEmpty()) {
            sessionsByEventId.remove(eventId);
        }
    }

    public void broadcastSeatMapChanged(Long eventId, String reason, List<Long> changedSeatIds) {
        if (eventId == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionsByEventId.get(eventId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        SeatMapRealtimeMessage message = new SeatMapRealtimeMessage(
                "SEAT_MAP_UPDATED",
                eventId,
                reason,
                changedSeatIds == null ? List.of() : changedSeatIds,
                Instant.now().toString()
        );

        sessions.forEach(session -> send(session, message));
    }

    private Long resolveEventId(WebSocketSession session) {
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String marker = "/ws/events/";
        int markerIndex = path.indexOf(marker);
        if (markerIndex < 0) {
            return null;
        }

        String suffix = path.substring(markerIndex + marker.length());
        String eventIdPart = suffix.split("/")[0];
        try {
            return Long.parseLong(eventIdPart);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private void send(WebSocketSession session, SeatMapRealtimeMessage message) {
        if (!session.isOpen()) {
            return;
        }

        try {
            synchronized (session) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
            }
        } catch (IOException exception) {
            try {
                session.close(CloseStatus.SERVER_ERROR.withReason("Unable to send seat map update"));
            } catch (IOException ignored) {
                // Session is already unusable.
            }
        }
    }
}
