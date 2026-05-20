package com.ticketrush.apigateway.chatbot.dto;

import java.util.List;

public record ChatbotResponse(
        String answer,
        boolean domainAllowed,
        boolean generatedByAi,
        List<ChatbotSource> sources,
        List<ChatbotAction> actions
) {
}
