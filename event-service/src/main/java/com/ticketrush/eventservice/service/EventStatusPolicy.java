package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.entity.Event;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

public final class EventStatusPolicy {
    public static final String LIVE = "LIVE";
    public static final String PENDING = "PENDING";
    public static final String DRAFT = "DRAFT";
    public static final String PAST = "PAST";

    private static final Set<String> ALLOWED_STATUSES = Set.of(LIVE, PENDING, DRAFT, PAST);

    private EventStatusPolicy() {
    }

    public static String resolveSubmittedStatus(String status, LocalDateTime startTime, LocalDateTime endTime) {
        String explicitStatus = normalizeStatus(status);
        if (explicitStatus != null) {
            if (!ALLOWED_STATUSES.contains(explicitStatus)) {
                throw new RuntimeException("Event status must be one of LIVE, PENDING, DRAFT, or PAST");
            }
            return explicitStatus;
        }

        if (startTime == null) {
            return DRAFT;
        }
        if (endTime != null && endTime.isBefore(LocalDateTime.now())) {
            return PAST;
        }
        if (!startTime.isAfter(LocalDateTime.now())) {
            return LIVE;
        }
        return PENDING;
    }

    public static String resolveDisplayStatus(Event event) {
        if (event == null) {
            return DRAFT;
        }

        String explicitStatus = normalizeStatus(event.getStatus());
        if (explicitStatus != null && ALLOWED_STATUSES.contains(explicitStatus)) {
            return explicitStatus;
        }

        if (event.getEndTime() != null && event.getEndTime().isBefore(LocalDateTime.now())) {
            return PAST;
        }

        if (event.getStartTime() == null) {
            return DRAFT;
        }
        return event.getStartTime().isAfter(LocalDateTime.now()) ? PENDING : LIVE;
    }

    public static boolean isCustomerVisible(Event event) {
        return !DRAFT.equals(resolveDisplayStatus(event));
    }

    public static boolean isBookable(Event event) {
        return LIVE.equals(resolveDisplayStatus(event));
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return status.trim().toUpperCase(Locale.ROOT);
    }
}
