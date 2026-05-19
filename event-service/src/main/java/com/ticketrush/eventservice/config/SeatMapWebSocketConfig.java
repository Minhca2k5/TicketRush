package com.ticketrush.eventservice.config;

import com.ticketrush.eventservice.realtime.SeatMapWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class SeatMapWebSocketConfig implements WebSocketConfigurer {

    private final SeatMapWebSocketHandler seatMapWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(seatMapWebSocketHandler, "/ws/events/{eventId}/seats")
                .setAllowedOriginPatterns("http://localhost:*");
    }
}
