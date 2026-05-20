package com.ticketrush.eventservice.config;

import com.ticketrush.eventservice.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EventLifecycleScheduler {

    private final EventService eventService;

    @Value("${app.event-lifecycle.end.enabled:true}")
    private boolean endEventEnabled;

    @Scheduled(fixedDelayString = "${app.event-lifecycle.end.delay-ms:60000}")
    public void closeEndedEvents() {
        if (!endEventEnabled) {
            return;
        }
        eventService.closeEndedEvents();
    }
}
