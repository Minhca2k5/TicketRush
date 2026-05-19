package com.ticketrush.eventservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketrush.eventservice.dto.ApiResponse;
import com.ticketrush.eventservice.dto.DashboardSummaryDTO;
import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventSummaryDTO;
import com.ticketrush.eventservice.dto.SeatMapLayoutDTO;
import com.ticketrush.eventservice.dto.SeatDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.dto.SeatLockRequestDTO;
import com.ticketrush.eventservice.dto.SeatPurchaseRequestDTO;
import com.ticketrush.eventservice.dto.SeatReleaseRequestDTO;
import com.ticketrush.eventservice.service.EventService;
import com.ticketrush.eventservice.service.SeatService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;
    private final SeatService seatService;
    private final ObjectMapper objectMapper;
    private final Path bannerUploadDirectory;
    private static final Set<String> ALLOWED_BANNER_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");

    public EventController(
            EventService eventService,
            SeatService seatService,
            ObjectMapper objectMapper,
            @Value("${app.upload.banner-dir:uploads/event-banners}") String bannerUploadDirectory
    ) {
        this.eventService = eventService;
        this.seatService = seatService;
        this.objectMapper = objectMapper;
        this.bannerUploadDirectory = Paths.get(bannerUploadDirectory).toAbsolutePath().normalize();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<EventSummaryDTO>>> getAllEvents() {
        return ResponseEntity.ok(ApiResponse.success("Events fetched successfully", eventService.getAllEvents()));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<EventSummaryDTO>>> searchEvents(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false, defaultValue = "date") String sort
    ) {
        List<EventSummaryDTO> results = eventService.searchEvents(q, category, from, to);

        switch (sort) {
            case "name" -> results.sort(Comparator.comparing(e -> e.getName() != null ? e.getName().toLowerCase() : ""));
            case "price" -> results.sort(Comparator.comparing(e -> e.getMinPrice() != null ? e.getMinPrice() : java.math.BigDecimal.ZERO));
            case "date" -> {} // Already sorted by date from query
            default -> {}
        }

        return ResponseEntity.ok(ApiResponse.success("Search results fetched successfully", results));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<DashboardSummaryDTO>> getDashboardSummary() {
        return ResponseEntity.ok(ApiResponse.success("Event dashboard fetched successfully", eventService.getDashboardSummary()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EventDTO>> getEventById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Event fetched successfully", eventService.getEventById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EventDTO>> createEvent(@RequestBody EventDTO eventDTO) {
        return ResponseEntity.ok(ApiResponse.success("Event created successfully", eventService.createEvent(eventDTO)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<EventDTO>> createEventMultipart(
            @RequestPart("payload") String payload,
            @RequestPart(value = "bannerFile", required = false) MultipartFile bannerFile,
            HttpServletRequest request
    ) {
        EventDTO eventDTO = readPayload(payload);
        applyBannerUpload(eventDTO, bannerFile, request);
        return ResponseEntity.ok(ApiResponse.success("Event created successfully", eventService.createEvent(eventDTO)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EventDTO>> updateEvent(@PathVariable Long id, @RequestBody EventDTO eventDTO) {
        return ResponseEntity.ok(ApiResponse.success("Event updated successfully", eventService.updateEvent(id, eventDTO)));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<EventDTO>> updateEventMultipart(
            @PathVariable Long id,
            @RequestPart("payload") String payload,
            @RequestPart(value = "bannerFile", required = false) MultipartFile bannerFile,
            HttpServletRequest request
    ) {
        EventDTO eventDTO = readPayload(payload);
        applyBannerUpload(eventDTO, bannerFile, request);
        return ResponseEntity.ok(ApiResponse.success("Event updated successfully", eventService.updateEvent(id, eventDTO)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
        return ResponseEntity.ok(ApiResponse.success("Event deleted successfully", null));
    }

    @GetMapping("/uploads/event-banners/{filename:.+}")
    public ResponseEntity<Resource> getUploadedEventBanner(@PathVariable String filename) {
        try {
            Path file = bannerUploadDirectory.resolve(filename).normalize();
            if (!file.startsWith(bannerUploadDirectory) || !Files.exists(file)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new UrlResource(file.toUri());
            String contentType = Files.probeContentType(file);
            MediaType mediaType = contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000")
                    .body(resource);
        } catch (MalformedURLException exception) {
            return ResponseEntity.notFound().build();
        } catch (IOException exception) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/seats")
    public ResponseEntity<ApiResponse<List<SeatDTO>>> getSeatMap(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Seat map fetched successfully", eventService.getSeatMap(id)));
    }

    @GetMapping("/{id}/seat-map")
    public ResponseEntity<ApiResponse<List<SeatDTO>>> getSeatMapAlias(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Seat map fetched successfully", eventService.getSeatMap(id)));
    }

    @GetMapping("/{id}/seat-layout")
    public ResponseEntity<ApiResponse<SeatMapLayoutDTO>> getSeatMapLayout(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Seat layout fetched successfully", eventService.getSeatMapLayout(id)));
    }

    @PostMapping("/{eventId}/seats/{seatId}/lock")
    public ResponseEntity<ApiResponse<SeatDTO>> lockSeat(
            @PathVariable Long eventId,
            @PathVariable Long seatId,
            @RequestBody SeatLockRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Seat locked successfully",
                seatService.lockSeat(eventId, seatId, request.getHolderId(), request.getHoldMinutes())
        ));
    }

    @PostMapping("/{eventId}/seats/{seatId}/release")
    public ResponseEntity<ApiResponse<SeatDTO>> releaseSeat(
            @PathVariable Long eventId,
            @PathVariable Long seatId,
            @RequestBody SeatReleaseRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Seat released successfully",
                seatService.releaseSeat(eventId, seatId, request.getHolderId())
        ));
    }

    @PostMapping("/{eventId}/seats/purchase")
    public ResponseEntity<ApiResponse<List<SeatDTO>>> purchaseSeats(
            @PathVariable Long eventId,
            @RequestBody SeatPurchaseRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Seats purchased successfully",
                seatService.purchaseSeats(eventId, request.getSeatIds(), request.getHolderId())
        ));
    }

    @PostMapping("/{id}/seats/batch")
    public ResponseEntity<Void> createSeatsBatch(@PathVariable Long id, @RequestBody SeatCreationRequest request) {
        request.setEventId(id);
        seatService.createSeatsForEvent(request);
        return ResponseEntity.ok().build();
    }

    private EventDTO readPayload(String payload) {
        try {
            return objectMapper.readValue(payload, EventDTO.class);
        } catch (IOException exception) {
            throw new RuntimeException("Invalid event payload");
        }
    }

    private void applyBannerUpload(EventDTO eventDTO, MultipartFile bannerFile, HttpServletRequest request) {
        if (bannerFile == null || bannerFile.isEmpty()) {
            return;
        }

        String originalName = bannerFile.getOriginalFilename();
        String extension = getExtension(originalName);
        if (!ALLOWED_BANNER_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("Banner image must be a JPG, PNG, JPEG, or WEBP file");
        }

        try {
            Files.createDirectories(bannerUploadDirectory);
            String storedFileName = UUID.randomUUID() + "." + extension;
            Path destination = bannerUploadDirectory.resolve(storedFileName).normalize();
            bannerFile.transferTo(destination);

            String publicUrl = buildBannerPublicUrl(request, storedFileName);
            eventDTO.setImageUrl(publicUrl);
            eventDTO.setBannerUrl(publicUrl);
        } catch (IOException exception) {
            throw new RuntimeException("Unable to store banner image");
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private String buildBannerPublicUrl(HttpServletRequest request, String filename) {
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        String forwardedHost = request.getHeader("X-Forwarded-Host");
        String scheme = forwardedProto != null && !forwardedProto.isBlank() ? forwardedProto : request.getScheme();
        String host = forwardedHost != null && !forwardedHost.isBlank()
                ? forwardedHost
                : request.getServerName() + (request.getServerPort() > 0 ? ":" + request.getServerPort() : "");

        return scheme + "://" + host + "/api/events/uploads/event-banners/" + filename;
    }
}
