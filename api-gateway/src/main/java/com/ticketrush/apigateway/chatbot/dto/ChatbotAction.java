package com.ticketrush.apigateway.chatbot.dto;

public record ChatbotAction(
        String label,
        String type,
        String value
) {
}
