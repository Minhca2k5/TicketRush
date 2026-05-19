package com.ticketrush.apigateway.chatbot;

import com.ticketrush.apigateway.chatbot.dto.ChatbotAction;
import com.ticketrush.apigateway.chatbot.dto.ChatbotResponse;
import com.ticketrush.apigateway.chatbot.dto.ChatbotSource;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class ChatbotService {
    private static final String OFF_DOMAIN_RESPONSE = """
            Mình chỉ hỗ trợ các câu hỏi liên quan đến TicketRush như sự kiện, đặt vé, ghế, tài khoản,
            vé đã mua, dashboard thống kê, Docker và kiến trúc hệ thống. Bạn muốn hỏi mình về phần nào trong TicketRush?
            """;

    private static final String SYSTEM_INSTRUCTION = """
            Bạn là TicketRush Assistant.
            Chỉ trả lời trong domain TicketRush: tài khoản, đăng nhập, đăng ký, sự kiện, gợi ý sự kiện,
            sơ đồ ghế, giữ ghế, đặt vé, checkout, My Tickets, admin dashboard, thống kê,
            kiến trúc backend/frontend, Docker, PostgreSQL, transaction và row locking.
            Khi người dùng hỏi tìm/gợi ý/chọn sự kiện, ưu tiên dùng EVENT CATALOG.
            Không bịa tên sự kiện, thời gian, địa điểm, giá hoặc tình trạng ghế ngoài context.
            Nếu không có sự kiện khớp hoàn toàn, nói rõ điều đó và gợi ý lựa chọn gần nhất trong catalog.
            Trả lời ngắn gọn, thân thiện, bằng tiếng Việt nếu người dùng hỏi tiếng Việt.
            """;

    private final ProjectDocumentRetriever documentRetriever;
    private final GeminiChatClient geminiChatClient;
    private final EventCatalogClient eventCatalogClient;

    public ChatbotService(
            ProjectDocumentRetriever documentRetriever,
            GeminiChatClient geminiChatClient,
            EventCatalogClient eventCatalogClient
    ) {
        this.documentRetriever = documentRetriever;
        this.geminiChatClient = geminiChatClient;
        this.eventCatalogClient = eventCatalogClient;
    }

    public Mono<ChatbotResponse> answer(String message) {
        String question = message == null ? "" : message.trim();
        if (question.isEmpty()) {
            return Mono.just(new ChatbotResponse(
                    "Bạn hãy nhập câu hỏi về TicketRush, ví dụ: gợi ý sự kiện thể thao, cách đặt vé, giữ ghế hoặc xem vé đã mua.",
                    true,
                    false,
                    List.of(),
                    defaultActions()
            ));
        }

        if (!documentRetriever.isDomainQuestion(question)) {
            return Mono.just(new ChatbotResponse(
                    OFF_DOMAIN_RESPONSE.trim(),
                    false,
                    false,
                    List.of(),
                    defaultActions()
            ));
        }

        List<ProjectDocumentRetriever.DocumentChunk> chunks = documentRetriever.retrieve(question, 5);
        return eventCatalogClient.fetchEvents()
                .flatMap(events -> answerWithContext(question, chunks, events));
    }

    private Mono<ChatbotResponse> answerWithContext(
            String question,
            List<ProjectDocumentRetriever.DocumentChunk> chunks,
            List<EventCatalogClient.EventCatalogItem> events
    ) {
        if (!geminiChatClient.isConfigured()) {
            return Mono.just(new ChatbotResponse(
                    buildLocalAnswer(question, events),
                    true,
                    false,
                    toSources(chunks, events),
                    eventActions(events)
            ));
        }

        String prompt = buildPrompt(question, chunks, events);
        return geminiChatClient.generate(SYSTEM_INSTRUCTION, prompt)
                .map(answer -> new ChatbotResponse(
                        answer,
                        true,
                        true,
                        toSources(chunks, events),
                        eventActions(events)
                ))
                .onErrorResume(error -> Mono.just(new ChatbotResponse(
                        buildLocalAnswer(question, events),
                        true,
                        false,
                        toSources(chunks, events),
                        eventActions(events)
                )));
    }

    private String buildPrompt(
            String question,
            List<ProjectDocumentRetriever.DocumentChunk> chunks,
            List<EventCatalogClient.EventCatalogItem> events
    ) {
        String projectContext = chunks.isEmpty()
                ? "No matching project documentation was found."
                : chunks.stream()
                .map(chunk -> "SOURCE: " + chunk.title() + "\n" + chunk.text())
                .collect(Collectors.joining("\n\n---\n\n"));

        return """
                TODAY:
                %s

                EVENT CATALOG:
                %s

                PROJECT CONTEXT:
                %s

                USER QUESTION:
                %s

                Hãy trả lời dựa trên EVENT CATALOG và PROJECT CONTEXT.
                Nếu người dùng hỏi "cuối tháng này", hiểu là giai đoạn 7 ngày cuối của tháng hiện tại theo TODAY.
                Với câu hỏi gợi ý sự kiện, nếu có thể hãy nêu lý do chọn, thời gian, địa điểm, giá từ và ghế còn lại.
                """.formatted(LocalDate.now(), formatEventCatalog(events), projectContext, question);
    }

    private String formatEventCatalog(List<EventCatalogClient.EventCatalogItem> events) {
        if (events == null || events.isEmpty()) {
            return "No events are currently available from event-service.";
        }

        return events.stream()
                .limit(12)
                .map(event -> "- id=%s | name=%s | category=%s | status=%s | start=%s | end=%s | venue=%s | location=%s | minPrice=%s | availableSeats=%d/%d | soldOut=%s | description=%s"
                        .formatted(
                                event.id(),
                                blankToTbd(event.name()),
                                blankToTbd(event.category()),
                                blankToTbd(event.status()),
                                event.startTime() == null ? "TBA" : event.startTime(),
                                event.endTime() == null ? "TBA" : event.endTime(),
                                blankToTbd(event.venueName()),
                                blankToTbd(event.location()),
                                event.minPrice() == null ? "TBA" : event.minPrice(),
                                event.availableSeats(),
                                event.totalSeats(),
                                event.soldOut(),
                                blankToTbd(event.description())
                        ))
                .collect(Collectors.joining("\n"));
    }

    private String buildLocalAnswer(String question, List<EventCatalogClient.EventCatalogItem> events) {
        if (events == null || events.isEmpty()) {
            return "Mình chưa lấy được danh sách sự kiện lúc này. Bạn có thể mở trang Events để kiểm tra lại.";
        }

        List<EventCatalogClient.EventCatalogItem> recommendations = recommendEvents(question, events);
        if (recommendations.isEmpty()) {
            return "Hiện chưa có sự kiện thể thao phù hợp với thời gian bạn hỏi. Bạn có thể xem tất cả sự kiện đang mở bán trong trang Events.";
        }

        String lines = recommendations.stream()
                .map(event -> "%s - %s, tại %s. Giá từ %s, còn %d/%d ghế."
                        .formatted(
                                blankToTbd(event.name()),
                                formatDateTime(event.startTime()),
                                blankToTbd(event.location()),
                                event.minPrice() == null ? "TBA" : "$" + event.minPrice(),
                                event.availableSeats(),
                                event.totalSeats()
                        ))
                .collect(Collectors.joining("\n"));

        String note = needsClosestMatchNote(question, recommendations)
                ? "Hiện chưa có sự kiện thể thao đúng 7 ngày cuối tháng này, nên mình gợi ý lựa chọn gần nhất:\n"
                : "Mình gợi ý sự kiện hợp với sở thích thể thao của bạn:\n";
        return note + lines;
    }

    private List<EventCatalogClient.EventCatalogItem> recommendEvents(
            String question,
            List<EventCatalogClient.EventCatalogItem> events
    ) {
        String normalized = normalize(question);
        boolean wantsSports = normalized.contains("sport")
                || normalized.contains("the thao")
                || normalized.contains("bong")
                || normalized.contains("championship");
        boolean endOfThisMonth = normalized.contains("cuoi thang")
                || normalized.contains("end of month")
                || normalized.contains("late month")
                || normalized.contains("cuoi thang 5")
                || normalized.contains("thang 5");

        LocalDate today = LocalDate.now();
        YearMonth thisMonth = YearMonth.from(today);
        LocalDate endWindowStart = thisMonth.atDay(Math.max(1, thisMonth.lengthOfMonth() - 6));
        LocalDate endWindowEnd = thisMonth.atEndOfMonth();

        List<EventCatalogClient.EventCatalogItem> strictMatches = events.stream()
                .filter(event -> !event.soldOut())
                .filter(event -> event.startTime() == null || !event.startTime().toLocalDate().isBefore(today))
                .filter(event -> !wantsSports || isSportsEvent(event))
                .filter(event -> !endOfThisMonth || isInRange(event.startTime(), endWindowStart, endWindowEnd))
                .sorted(eventComparator())
                .limit(3)
                .toList();

        if (!strictMatches.isEmpty()) {
            return strictMatches;
        }

        return events.stream()
                .filter(event -> !event.soldOut())
                .filter(event -> event.startTime() == null || !event.startTime().toLocalDate().isBefore(today))
                .filter(event -> !wantsSports || isSportsEvent(event))
                .sorted(eventComparator())
                .limit(3)
                .toList();
    }

    private boolean isSportsEvent(EventCatalogClient.EventCatalogItem event) {
        String category = normalize(event.category());
        String description = normalize(event.description());
        String name = normalize(event.name());
        return category.contains("sport") || description.contains("sport") || name.contains("championship");
    }

    private Comparator<EventCatalogClient.EventCatalogItem> eventComparator() {
        return Comparator
                .comparing(EventCatalogClient.EventCatalogItem::startTime, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(EventCatalogClient.EventCatalogItem::availableSeats, Comparator.reverseOrder());
    }

    private boolean isInRange(LocalDateTime value, LocalDate start, LocalDate end) {
        if (value == null) {
            return false;
        }
        LocalDate date = value.toLocalDate();
        return !date.isBefore(start) && !date.isAfter(end);
    }

    private boolean needsClosestMatchNote(String question, List<EventCatalogClient.EventCatalogItem> recommendations) {
        String normalized = normalize(question);
        boolean asksEndOfMonth = normalized.contains("cuoi thang")
                || normalized.contains("cuoi thang 5")
                || normalized.contains("thang 5")
                || normalized.contains("end of month");
        if (!asksEndOfMonth || recommendations.isEmpty()) {
            return false;
        }

        YearMonth thisMonth = YearMonth.from(LocalDate.now());
        LocalDate start = thisMonth.atDay(Math.max(1, thisMonth.lengthOfMonth() - 6));
        LocalDate end = thisMonth.atEndOfMonth();
        return recommendations.stream().noneMatch(event -> isInRange(event.startTime(), start, end));
    }

    private List<ChatbotSource> toSources(
            List<ProjectDocumentRetriever.DocumentChunk> chunks,
            List<EventCatalogClient.EventCatalogItem> events
    ) {
        List<ChatbotSource> sources = new ArrayList<>(chunks.stream()
                .map(ProjectDocumentRetriever.DocumentChunk::title)
                .distinct()
                .map(ChatbotSource::new)
                .toList());

        if (events != null && !events.isEmpty()) {
            sources.add(new ChatbotSource("Live event catalog"));
        }
        return sources;
    }

    private List<ChatbotAction> eventActions(List<EventCatalogClient.EventCatalogItem> events) {
        List<ChatbotAction> actions = new ArrayList<>();
        actions.add(new ChatbotAction("Browse events", "route", "/events"));
        if (events != null) {
            events.stream()
                    .filter(event -> event.id() != null)
                    .limit(2)
                    .forEach(event -> actions.add(new ChatbotAction(
                            event.name() == null || event.name().isBlank() ? "View event" : event.name(),
                            "route",
                            "/events/" + event.id()
                    )));
        }
        actions.add(new ChatbotAction("My tickets", "route", "/orders"));
        return actions;
    }

    private List<ChatbotAction> defaultActions() {
        return List.of(
                new ChatbotAction("Browse events", "route", "/events"),
                new ChatbotAction("My tickets", "route", "/orders"),
                new ChatbotAction("Login", "route", "/login")
        );
    }

    private static String blankToTbd(String value) {
        return value == null || value.isBlank() ? "TBA" : value;
    }

    private static String formatDateTime(LocalDateTime value) {
        if (value == null) {
            return "thời gian chưa công bố";
        }
        return value.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase(Locale.ROOT);
    }
}
