package com.ticketrush.apigateway.chatbot;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class EventCatalogClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(EventCatalogClient.class);

    private final WebClient webClient;

    @Value("${chatbot.event-service.base-url:http://localhost:8082}")
    private String eventServiceBaseUrl;

    public EventCatalogClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public Mono<List<EventCatalogItem>> fetchEvents() {
        return webClient.get()
                .uri(eventServiceBaseUrl + "/api/events")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(this::extractEvents)
                .doOnError(error -> LOGGER.warn("Could not fetch event catalog for chatbot: {}", error.getMessage()))
                .onErrorReturn(List.of());
    }

    private List<EventCatalogItem> extractEvents(JsonNode root) {
        JsonNode data = root.path("data");
        if (!data.isArray()) {
            data = root;
        }
        if (!data.isArray()) {
            return List.of();
        }

        List<EventCatalogItem> events = new ArrayList<>();
        for (JsonNode item : data) {
            if (item.isObject()) {
                events.add(toEventCatalogItem(item));
            }
        }

        return events.stream()
                .sorted(Comparator.comparing(
                        EventCatalogItem::startTime,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .toList();
    }

    private EventCatalogItem toEventCatalogItem(JsonNode node) {
        JsonNode venue = node.path("venue");
        String location = text(node, "location");
        if (location.isBlank()) {
            location = text(venue, "address");
        }

        return new EventCatalogItem(
                node.path("id").isNumber() ? node.path("id").asLong() : null,
                text(node, "name"),
                text(node, "category"),
                text(node, "organizer"),
                text(node, "description"),
                location,
                text(venue, "name"),
                parseDateTime(text(node, "startTime")),
                parseDateTime(text(node, "endTime")),
                text(node, "status"),
                decimal(node.path("minPrice")),
                node.path("soldOut").asBoolean(false),
                node.path("availableSeats").asInt(0),
                node.path("totalSeats").asInt(0)
        );
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText("").trim();
    }

    private static BigDecimal decimal(JsonNode node) {
        if (node.isNumber()) {
            return node.decimalValue();
        }
        if (node.isTextual() && !node.asText().isBlank()) {
            try {
                return new BigDecimal(node.asText());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    public record EventCatalogItem(
            Long id,
            String name,
            String category,
            String organizer,
            String description,
            String location,
            String venueName,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String status,
            BigDecimal minPrice,
            boolean soldOut,
            int availableSeats,
            int totalSeats
    ) {
    }
}
