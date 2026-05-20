package com.ticketrush.apigateway.chatbot;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class GeminiChatClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(GeminiChatClient.class);
    private static final String EMPTY_ANSWER = "Gemini did not return an answer right now.";

    private final WebClient webClient;

    @Value("${chatbot.gemini.api-key:}")
    private String apiKey;

    @Value("${chatbot.gemini.model:gemini-2.5-flash}")
    private String model;

    @Value("${chatbot.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String baseUrl;

    public GeminiChatClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public Mono<String> generate(String systemInstruction, String userPrompt) {
        if (!isConfigured()) {
            return Mono.error(new IllegalStateException("Gemini API key is not configured"));
        }

        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of(
                        "parts", List.of(Map.of("text", systemInstruction))
                ),
                "contents", List.of(
                        Map.of(
                                "role", "user",
                                "parts", List.of(Map.of("text", userPrompt))
                        )
                ),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "topP", 0.8,
                        "maxOutputTokens", 700
                )
        );

        return webClient.post()
                .uri(baseUrl + "/models/{model}:generateContent?key={key}", model, apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .exchangeToMono(response -> {
                    if (response.statusCode().isError()) {
                        return response.bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .flatMap(errorBody -> Mono.error(new GeminiApiException(
                                        response.statusCode().value(),
                                        compact(errorBody)
                                )));
                    }
                    return response.bodyToMono(JsonNode.class);
                })
                .map(this::extractText)
                .doOnError(error -> LOGGER.warn("Gemini request failed: {}", error.getMessage()));
    }

    private String extractText(JsonNode root) {
        JsonNode parts = root.path("candidates").path(0).path("content").path("parts");
        if (!parts.isArray()) {
            return EMPTY_ANSWER;
        }

        StringBuilder builder = new StringBuilder();
        for (JsonNode part : parts) {
            String text = part.path("text").asText("");
            if (!text.isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append("\n");
                }
                builder.append(text.trim());
            }
        }
        return builder.isEmpty() ? EMPTY_ANSWER : builder.toString();
    }

    private static String compact(String value) {
        if (value == null || value.isBlank()) {
            return "empty response body";
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private static class GeminiApiException extends RuntimeException {
        GeminiApiException(int statusCode, String responseBody) {
            super("Gemini API returned HTTP " + statusCode + ": " + responseBody);
        }
    }
}
