package com.ticketrush.apigateway.chatbot;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class ProjectDocumentRetriever {
    private static final int MAX_CHUNK_LENGTH = 1400;
    private static final Pattern TOKEN_SPLIT_PATTERN = Pattern.compile("[^a-z0-9]+");

    private static final Set<String> DOMAIN_TERMS = Set.of(
            "ticketrush", "ticket", "tickets", "event", "events", "seat", "seats", "booking",
            "book", "checkout", "order", "orders", "login", "register", "profile", "admin",
            "dashboard", "revenue", "customer", "queue", "gateway", "auth", "venue", "zone",
            "postgres", "database", "concurrency", "lock", "locking", "transaction", "spring",
            "docker", "api", "frontend", "backend", "react", "java", "dat", "ve", "ghe",
            "su", "kien", "dang", "nhap", "ky", "thong", "ke", "doanh", "thu",
            "goi", "y", "de", "xuat", "nen", "di", "the", "thao", "sport", "sports",
            "cuoi", "thang", "hom", "nay", "mai"
    );
    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
            "how", "i", "in", "is", "it", "of", "on", "or", "the", "this", "to", "was",
            "were", "what", "when", "where", "who", "why", "with", "you", "your",
            "ai", "ban", "bi", "cach", "cho", "co", "cua", "duoc", "gi", "hay", "hoi",
            "khong", "la", "lam", "minh", "mot", "nao", "neu", "nhu", "toi", "trong", "va"
    );

    @Value("${chatbot.rag.document-paths:../ARCHITECTURE.md,../TicketRush-Roadmap.md,../CONVENTIONS.md,../docker-compose.yml}")
    private String documentPaths;

    private final List<DocumentChunk> chunks = new ArrayList<>();

    @PostConstruct
    public void loadDocuments() {
        chunks.clear();
        for (String rawPath : documentPaths.split(",")) {
            String trimmedPath = rawPath.trim();
            if (trimmedPath.isEmpty()) {
                continue;
            }

            Path path = Path.of(trimmedPath).normalize();
            if (!Files.exists(path) || !Files.isRegularFile(path)) {
                continue;
            }

            try {
                String content = Files.readString(path, StandardCharsets.UTF_8);
                chunks.addAll(chunkDocument(path.getFileName().toString(), content));
            } catch (IOException ignored) {
                // Missing documentation should not stop the gateway from starting.
            }
        }
    }

    public boolean isDomainQuestion(String question) {
        Set<String> tokens = tokenize(question);
        if (tokens.stream().anyMatch(DOMAIN_TERMS::contains)) {
            return true;
        }

        return !retrieve(question, 1).isEmpty();
    }

    public List<DocumentChunk> retrieve(String question, int limit) {
        Set<String> queryTokens = tokenize(question);
        if (queryTokens.isEmpty() || chunks.isEmpty()) {
            return List.of();
        }

        return chunks.stream()
                .map(chunk -> new ScoredChunk(chunk, score(queryTokens, chunk.tokens())))
                .filter(scored -> scored.score() > 0)
                .sorted(Comparator.comparingInt(ScoredChunk::score).reversed())
                .limit(limit)
                .map(ScoredChunk::chunk)
                .toList();
    }

    private List<DocumentChunk> chunkDocument(String title, String content) {
        String normalizedContent = content.replace("\r\n", "\n").trim();
        List<DocumentChunk> result = new ArrayList<>();
        String[] sections = normalizedContent.split("(?m)(?=^#{1,3}\\s+)");

        for (String section : sections) {
            String cleaned = section.trim();
            if (cleaned.isEmpty()) {
                continue;
            }

            while (cleaned.length() > MAX_CHUNK_LENGTH) {
                int splitAt = findSplitPoint(cleaned);
                String part = cleaned.substring(0, splitAt).trim();
                if (!part.isEmpty()) {
                    result.add(toChunk(title, part));
                }
                cleaned = cleaned.substring(splitAt).trim();
            }

            if (!cleaned.isEmpty()) {
                result.add(toChunk(title, cleaned));
            }
        }

        return result;
    }

    private DocumentChunk toChunk(String title, String text) {
        return new DocumentChunk(title, text, tokenize(text));
    }

    private int findSplitPoint(String text) {
        int paragraphBreak = text.lastIndexOf("\n\n", MAX_CHUNK_LENGTH);
        if (paragraphBreak > 400) {
            return paragraphBreak;
        }

        int lineBreak = text.lastIndexOf('\n', MAX_CHUNK_LENGTH);
        if (lineBreak > 400) {
            return lineBreak;
        }

        return MAX_CHUNK_LENGTH;
    }

    private int score(Set<String> queryTokens, Set<String> chunkTokens) {
        int score = 0;
        for (String token : queryTokens) {
            if (chunkTokens.contains(token)) {
                score += DOMAIN_TERMS.contains(token) ? 3 : 1;
            }
        }
        return score;
    }

    private Set<String> tokenize(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase(Locale.ROOT);

        String[] tokens = TOKEN_SPLIT_PATTERN.split(normalized);
        Set<String> result = new HashSet<>();
        for (String token : tokens) {
            if (token.length() >= 2 && !STOP_WORDS.contains(token)) {
                result.add(token);
            }
        }
        return result;
    }

    public record DocumentChunk(String title, String text, Set<String> tokens) {
    }

    private record ScoredChunk(DocumentChunk chunk, int score) {
    }
}
