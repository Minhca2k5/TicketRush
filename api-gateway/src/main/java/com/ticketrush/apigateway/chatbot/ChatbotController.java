package com.ticketrush.apigateway.chatbot;

import com.ticketrush.apigateway.chatbot.dto.ChatbotRequest;
import com.ticketrush.apigateway.chatbot.dto.ChatbotResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/chatbot")
public class ChatbotController {
    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping
    public Mono<ResponseEntity<ChatbotResponse>> chat(@RequestBody ChatbotRequest request) {
        return chatbotService.answer(request.message())
                .map(ResponseEntity::ok);
    }
}
