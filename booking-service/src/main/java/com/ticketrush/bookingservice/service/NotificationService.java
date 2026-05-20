package com.ticketrush.bookingservice.service;

import com.ticketrush.bookingservice.dto.ApiResponse;
import com.ticketrush.bookingservice.dto.EventSnapshotDTO;
import com.ticketrush.bookingservice.dto.NotificationDTO;
import com.ticketrush.bookingservice.dto.SeatDTO;
import com.ticketrush.bookingservice.entity.Notification;
import com.ticketrush.bookingservice.entity.Order;
import com.ticketrush.bookingservice.repository.NotificationRepository;
import com.ticketrush.bookingservice.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_NOTIFICATIONS = 50;
    private static final int UPCOMING_EVENT_WINDOW_HOURS = 24;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm");

    private final NotificationRepository notificationRepository;
    private final OrderRepository orderRepository;
    private final RestTemplate restTemplate;

    @Value("${app.event-service-url}")
    private String eventServiceUrl;

    @Transactional
    public List<NotificationDTO> getUserNotifications(String userId) {
        createUpcomingEventNotifications(userId);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, MAX_NOTIFICATIONS))
                .stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public NotificationDTO markAsRead(String userId, Long id) {
        Notification notification = notificationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        markRead(notification);
        return NotificationDTO.fromEntity(notificationRepository.save(notification));
    }

    @Transactional
    public List<NotificationDTO> markAllAsRead(String userId) {
        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, MAX_NOTIFICATIONS));
        notifications.forEach(this::markRead);
        return notificationRepository.saveAll(notifications).stream()
                .map(NotificationDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteNotification(String userId, Long id) {
        Notification notification = notificationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notificationRepository.delete(notification);
    }

    @Transactional
    public void clearUserNotifications(String userId) {
        notificationRepository.deleteByUserId(userId);
    }

    @Transactional
    public void createTicketPurchasedNotification(Order order, int ticketCount, BigDecimal totalPrice) {
        if (order == null || order.getUserId() == null) {
            return;
        }

        EventSnapshotDTO event = fetchEvent(order.getEventId()).orElse(null);
        String eventName = event != null ? event.displayName() : "your event";
        String amount = totalPrice == null ? "$0" : "$" + totalPrice.stripTrailingZeros().toPlainString();

        createNotificationIfAbsent(
                order.getUserId(),
                "TICKET_PURCHASED",
                "Ticket purchase successful",
                String.format("You bought %d ticket(s) for %s. Total paid: %s.", ticketCount, eventName, amount),
                "/orders",
                order.getEventId(),
                null,
                "ticket-purchased:" + order.getId()
        );
    }

    @Transactional
    public void createSeatReleasedNotification(String userId, Long eventId, SeatDTO seat) {
        if (userId == null || userId.isBlank() || seat == null || seat.getId() == null) {
            return;
        }

        EventSnapshotDTO event = fetchEvent(eventId).orElse(null);
        String eventName = event != null ? event.displayName() : "your event";
        String seatLabel = firstNonBlank(seat.getSeatNumber(), seat.getRowName(), "selected seat");

        String dedupeKey = seat.getLockExpiresAt() == null
                ? null
                : "seat-released:" + userId + ":" + eventId + ":" + seat.getId() + ":" + seat.getLockExpiresAt();

        createNotificationIfAbsent(
                userId,
                "SEAT_RELEASED",
                "Seat hold released",
                String.format("Your hold for seat %s at %s was released.", seatLabel, eventName),
                eventId == null ? "/events" : "/events/" + eventId,
                eventId,
                seat.getId(),
                dedupeKey
        );
    }

    @Transactional
    public void createUpcomingEventNotificationsForAllUsers() {
        orderRepository.findAll().stream()
                .map(Order::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(this::createUpcomingEventNotifications);
    }

    @Transactional
    public void createEventEndedNotificationsForAllAttendees(Long eventId, String eventName) {
        if (eventId == null) {
            return;
        }

        String name = eventName != null && !eventName.isBlank() ? eventName : "your event";

        List<Order> paidOrders = orderRepository.findByEventIdAndStatus(eventId, "PAID");
        if (paidOrders == null || paidOrders.isEmpty()) {
            return;
        }

        List<String> distinctUserIds = paidOrders.stream()
                .map(Order::getUserId)
                .filter(Objects::nonNull)
                .filter(userId -> !userId.isBlank())
                .distinct()
                .collect(Collectors.toList());

        for (String userId : distinctUserIds) {
            createNotificationIfAbsent(
                    userId,
                    "EVENT_ENDED",
                    "Share your experience!",
                    String.format("How was %s? Leave a review and rate your experience now!", name),
                    "/events/" + eventId,
                    eventId,
                    null,
                    "event-ended:" + userId + ":" + eventId
            );
        }
    }


    private void createUpcomingEventNotifications(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowEnd = now.plusHours(UPCOMING_EVENT_WINDOW_HOURS);

        orderRepository.findByUserId(userId).stream()
                .filter(order -> "PAID".equalsIgnoreCase(order.getStatus()))
                .map(Order::getEventId)
                .filter(Objects::nonNull)
                .distinct()
                .map(this::fetchEvent)
                .flatMap(Optional::stream)
                .filter(event -> event.getStartTime() != null)
                .filter(event -> !event.getStartTime().isBefore(now) && !event.getStartTime().isAfter(windowEnd))
                .sorted(Comparator.comparing(EventSnapshotDTO::getStartTime))
                .forEach(event -> createNotificationIfAbsent(
                        userId,
                        "EVENT_UPCOMING",
                        "Event coming soon",
                        String.format(
                                "%s starts at %s at %s.",
                                event.displayName(),
                                event.getStartTime().format(DATE_FORMATTER),
                                event.displayLocation()
                        ),
                        "/events/" + event.getId(),
                        event.getId(),
                        null,
                        "event-upcoming:" + userId + ":" + event.getId()
                ));
    }

    private Optional<EventSnapshotDTO> fetchEvent(Long eventId) {
        if (eventId == null) {
            return Optional.empty();
        }

        try {
            String url = eventServiceUrl + "/api/events/" + eventId;
            ResponseEntity<ApiResponse<EventSnapshotDTO>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<ApiResponse<EventSnapshotDTO>>() {
                    }
            );
            return Optional.ofNullable(response.getBody()).map(ApiResponse::getData);
        } catch (RestClientException exception) {
            return Optional.empty();
        }
    }

    private Notification createNotificationIfAbsent(
            String userId,
            String type,
            String title,
            String message,
            String actionUrl,
            Long eventId,
            Long seatId,
            String dedupeKey
    ) {
        if (dedupeKey != null && notificationRepository.findByUserIdAndDedupeKey(userId, dedupeKey).isPresent()) {
            return null;
        }
        return createNotification(userId, type, title, message, actionUrl, eventId, seatId, dedupeKey);
    }

    private Notification createNotification(
            String userId,
            String type,
            String title,
            String message,
            String actionUrl,
            Long eventId,
            Long seatId,
            String dedupeKey
    ) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setActionUrl(actionUrl);
        notification.setEventId(eventId);
        notification.setSeatId(seatId);
        notification.setDedupeKey(dedupeKey);
        notification.setRead(false);
        return notificationRepository.save(notification);
    }

    private void markRead(Notification notification) {
        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(Instant.now());
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
