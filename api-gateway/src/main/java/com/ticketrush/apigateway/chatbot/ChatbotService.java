package com.ticketrush.apigateway.chatbot;

import com.ticketrush.apigateway.chatbot.dto.ChatbotAction;
import com.ticketrush.apigateway.chatbot.dto.ChatbotResponse;
import com.ticketrush.apigateway.chatbot.dto.ChatbotSource;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ChatbotService {
    private static final String OFF_DOMAIN_RESPONSE = """
            Mình chỉ hỗ trợ các câu hỏi liên quan đến TicketRush như sự kiện, đặt vé, ghế, tài khoản, vé đã mua và dashboard thống kê. Bạn có muốn hỏi mình về phần nào trong TicketRush không?
            """;

    private static final String SYSTEM_INSTRUCTION = """
            Bạn là TicketRush Assistant.
            Chỉ trả lời trong domain dự án TicketRush: tài khoản, đăng nhập, đăng ký, sự kiện,
            sơ đồ ghế, giữ ghế, đặt vé, checkout, My Tickets, admin dashboard, thống kê,
            kiến trúc backend/frontend, Docker, PostgreSQL, transaction và row locking.
            Chỉ dùng thông tin trong PROJECT CONTEXT. Không bịa thông tin.
            Nếu câu hỏi nằm ngoài TicketRush hoặc context không đủ, hãy từ chối lịch sự và gợi ý người dùng hỏi về TicketRush.
            Trả lời ngắn gọn, thân thiện, bằng tiếng Việt nếu người dùng hỏi tiếng Việt.
            """;

    private final ProjectDocumentRetriever documentRetriever;
    private final GeminiChatClient geminiChatClient;

    public ChatbotService(ProjectDocumentRetriever documentRetriever, GeminiChatClient geminiChatClient) {
        this.documentRetriever = documentRetriever;
        this.geminiChatClient = geminiChatClient;
    }

    public Mono<ChatbotResponse> answer(String message) {
        String question = message == null ? "" : message.trim();
        if (question.isEmpty()) {
            return Mono.just(new ChatbotResponse(
                    "Bạn hãy nhập câu hỏi về TicketRush, ví dụ: cách đặt vé, giữ ghế, xem vé hoặc thống kê admin.",
                    true,
                    false,
                    List.of(),
                    defaultActions()
            ));
        }

        List<ProjectDocumentRetriever.DocumentChunk> chunks = documentRetriever.retrieve(question, 5);
        boolean domainAllowed = documentRetriever.isDomainQuestion(question);
        if (!domainAllowed) {
            return Mono.just(new ChatbotResponse(
                    OFF_DOMAIN_RESPONSE.trim(),
                    false,
                    false,
                    List.of(),
                    defaultActions()
            ));
        }

        if (!geminiChatClient.isConfigured()) {
            return Mono.just(new ChatbotResponse(
                    "Backend chatbot đã sẵn sàng, nhưng chưa có GEMINI_API_KEY. Hãy thêm key vào file .env rồi rebuild api-gateway để mình trả lời bằng Gemini.",
                    true,
                    false,
                    toSources(chunks),
                    List.of(new ChatbotAction("Browse events", "route", "/events"))
            ));
        }

        String prompt = buildPrompt(question, chunks);
        return geminiChatClient.generate(SYSTEM_INSTRUCTION, prompt)
                .map(answer -> new ChatbotResponse(
                        answer,
                        true,
                        true,
                        toSources(chunks),
                        defaultActions()
                ))
                .onErrorResume(error -> Mono.just(new ChatbotResponse(
                        "Mình chưa gọi được Gemini lúc này. Vui lòng kiểm tra GEMINI_API_KEY, mạng hoặc quota API rồi thử lại.",
                        true,
                        false,
                        toSources(chunks),
                        defaultActions()
                )));
    }

    private String buildPrompt(String question, List<ProjectDocumentRetriever.DocumentChunk> chunks) {
        String context = chunks.isEmpty()
                ? "No matching project documentation was found."
                : chunks.stream()
                .map(chunk -> "SOURCE: " + chunk.title() + "\n" + chunk.text())
                .collect(Collectors.joining("\n\n---\n\n"));

        return """
                PROJECT CONTEXT:
                %s

                USER QUESTION:
                %s

                Hãy trả lời dựa trên PROJECT CONTEXT. Nếu context không đủ, nói rõ là chưa có thông tin trong tài liệu dự án.
                """.formatted(context, question);
    }

    private List<ChatbotSource> toSources(List<ProjectDocumentRetriever.DocumentChunk> chunks) {
        return chunks.stream()
                .map(ProjectDocumentRetriever.DocumentChunk::title)
                .distinct()
                .map(ChatbotSource::new)
                .toList();
    }

    private List<ChatbotAction> defaultActions() {
        return List.of(
                new ChatbotAction("Browse events", "route", "/events"),
                new ChatbotAction("My tickets", "route", "/orders"),
                new ChatbotAction("Login", "route", "/login")
        );
    }
}
