package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.DashboardBreakdownItemDTO;
import com.ticketrush.eventservice.dto.DashboardDemographicsDTO;
import com.ticketrush.eventservice.dto.DashboardEventOccupancyDTO;
import com.ticketrush.eventservice.dto.DashboardOccupancyDTO;
import com.ticketrush.eventservice.dto.DashboardRevenueCategoryDTO;
import com.ticketrush.eventservice.dto.DashboardRevenueDTO;
import com.ticketrush.eventservice.dto.DashboardRevenueEventDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final Set<String> SOLD_STATUSES = Set.of("SOLD", "BOOKED", "UNAVAILABLE");
    private static final Set<String> LOCKED_STATUSES = Set.of("LOCKED", "WAITING", "HELD", "RESERVED");

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final SeatService seatService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public DashboardRevenueDTO getRevenueMetrics() {
        List<Event> events = eventRepository.findAll();
        releaseExpiredLocks(events);

        Map<Long, Event> eventLookup = events.stream()
                .collect(Collectors.toMap(Event::getId, Function.identity()));

        List<Seat> soldSeats = seatRepository.findAll().stream()
                .filter(this::isSoldSeat)
                .filter(seat -> seat.getEvent() != null)
                .toList();

        BigDecimal totalRevenue = soldSeats.stream()
                .map(this::resolveSeatPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long soldTickets = soldSeats.size();
        BigDecimal averageTicketPrice = soldTickets == 0
                ? BigDecimal.ZERO
                : totalRevenue.divide(BigDecimal.valueOf(soldTickets), 2, RoundingMode.HALF_UP);

        List<DashboardRevenueEventDTO> eventBreakdown = soldSeats.stream()
                .collect(Collectors.groupingBy(seat -> seat.getEvent().getId(), LinkedHashMap::new, Collectors.toList()))
                .entrySet().stream()
                .map(entry -> {
                    Event event = eventLookup.get(entry.getKey());
                    BigDecimal revenue = entry.getValue().stream()
                            .map(this::resolveSeatPrice)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    return new DashboardRevenueEventDTO(
                            event != null ? event.getId() : entry.getKey(),
                            event != null ? event.getName() : "Unknown Event",
                            normalizeCategory(event != null ? event.getCategory() : null),
                            normalizeStatus(event != null ? event.getStatus() : null),
                            revenue,
                            entry.getValue().size()
                    );
                })
                .sorted(Comparator
                        .comparing(DashboardRevenueEventDTO::getRevenue, Comparator.reverseOrder())
                        .thenComparing(DashboardRevenueEventDTO::getEventName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<DashboardRevenueCategoryDTO> categoryBreakdown = soldSeats.stream()
                .collect(Collectors.groupingBy(
                        seat -> normalizeCategory(seat.getEvent() != null ? seat.getEvent().getCategory() : null),
                        LinkedHashMap::new,
                        Collectors.toList()
                ))
                .entrySet().stream()
                .map(entry -> new DashboardRevenueCategoryDTO(
                        entry.getKey(),
                        entry.getValue().stream()
                                .map(this::resolveSeatPrice)
                                .reduce(BigDecimal.ZERO, BigDecimal::add),
                        entry.getValue().size()
                ))
                .sorted(Comparator
                        .comparing(DashboardRevenueCategoryDTO::getRevenue, Comparator.reverseOrder())
                        .thenComparing(DashboardRevenueCategoryDTO::getCategory, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new DashboardRevenueDTO(totalRevenue, soldTickets, averageTicketPrice, eventBreakdown, categoryBreakdown);
    }

    @Transactional
    public DashboardOccupancyDTO getOccupancyMetrics() {
        List<Event> events = eventRepository.findAll();
        releaseExpiredLocks(events);

        List<Seat> seats = seatRepository.findAll();
        Map<Long, List<Seat>> seatsByEvent = seats.stream()
                .filter(seat -> seat.getEvent() != null)
                .collect(Collectors.groupingBy(seat -> seat.getEvent().getId()));

        int totalSeats = seats.size();
        int soldSeats = (int) seats.stream().filter(this::isSoldSeat).count();
        int lockedSeats = (int) seats.stream().filter(this::isLockedSeat).count();
        int availableSeats = Math.max(0, totalSeats - soldSeats - lockedSeats);

        List<DashboardEventOccupancyDTO> eventBreakdown = events.stream()
                .map(event -> {
                    List<Seat> eventSeats = seatsByEvent.getOrDefault(event.getId(), List.of());
                    int eventTotal = eventSeats.size();
                    int eventSold = (int) eventSeats.stream().filter(this::isSoldSeat).count();
                    int eventLocked = (int) eventSeats.stream().filter(this::isLockedSeat).count();
                    int eventAvailable = Math.max(0, eventTotal - eventSold - eventLocked);
                    return new DashboardEventOccupancyDTO(
                            event.getId(),
                            event.getName(),
                            event.getVenue() != null ? event.getVenue().getName() : "Venue TBD",
                            normalizeStatus(event.getStatus()),
                            eventTotal,
                            eventSold,
                            eventLocked,
                            eventAvailable,
                            percentage(eventSold, eventTotal)
                    );
                })
                .sorted(Comparator
                        .comparing(DashboardEventOccupancyDTO::getOccupancyRate, Comparator.reverseOrder())
                        .thenComparing(DashboardEventOccupancyDTO::getEventName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new DashboardOccupancyDTO(
                totalSeats,
                soldSeats,
                lockedSeats,
                availableSeats,
                percentage(soldSeats, totalSeats),
                eventBreakdown
        );
    }

    @Transactional(readOnly = true)
    public DashboardDemographicsDTO getDemographicsMetrics() {
        try {
            long totalCustomers = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER'",
                    Long.class
            );

            List<DashboardBreakdownItemDTO> genderBreakdown = mapGenderBreakdown(totalCustomers);
            List<DashboardBreakdownItemDTO> ageBreakdown = mapAgeBreakdown(totalCustomers);

            return new DashboardDemographicsDTO(
                    true,
                    "REGISTERED_CUSTOMERS",
                    "Aggregated from auth-service customer profiles stored in the shared TicketRush database.",
                    totalCustomers,
                    genderBreakdown,
                    ageBreakdown
            );
        } catch (DataAccessException exception) {
            return new DashboardDemographicsDTO(
                    false,
                    "REGISTERED_CUSTOMERS",
                    "Customer demographics are unavailable because the shared users table is not ready in the current database.",
                    0,
                    List.of(),
                    List.of()
            );
        }
    }

    private List<DashboardBreakdownItemDTO> mapGenderBreakdown(long totalCustomers) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT COALESCE(gender, 'U') AS gender_code, COUNT(*) AS total
                FROM users
                WHERE role = 'CUSTOMER'
                GROUP BY COALESCE(gender, 'U')
                """
        );

        Map<String, String> labels = Map.of(
                "M", "Male",
                "F", "Female",
                "U", "Unknown"
        );

        return rows.stream()
                .map(row -> {
                    String code = Objects.toString(row.get("gender_code"), "U").toUpperCase(Locale.ROOT);
                    long count = ((Number) row.get("total")).longValue();
                    return new DashboardBreakdownItemDTO(
                            labels.getOrDefault(code, "Unknown"),
                            count,
                            percentage(count, totalCustomers)
                    );
                })
                .sorted(Comparator
                        .comparingLong(DashboardBreakdownItemDTO::getCount).reversed()
                        .thenComparing(DashboardBreakdownItemDTO::getLabel, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<DashboardBreakdownItemDTO> mapAgeBreakdown(long totalCustomers) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                    CASE
                        WHEN age IS NULL THEN 'Unknown'
                        WHEN age < 18 THEN 'Under 18'
                        WHEN age BETWEEN 18 AND 24 THEN '18-24'
                        WHEN age BETWEEN 25 AND 34 THEN '25-34'
                        WHEN age BETWEEN 35 AND 44 THEN '35-44'
                        ELSE '45+'
                    END AS age_bucket,
                    COUNT(*) AS total
                FROM users
                WHERE role = 'CUSTOMER'
                GROUP BY
                    CASE
                        WHEN age IS NULL THEN 'Unknown'
                        WHEN age < 18 THEN 'Under 18'
                        WHEN age BETWEEN 18 AND 24 THEN '18-24'
                        WHEN age BETWEEN 25 AND 34 THEN '25-34'
                        WHEN age BETWEEN 35 AND 44 THEN '35-44'
                        ELSE '45+'
                    END
                """
        );

        Map<String, Integer> bucketOrder = new LinkedHashMap<>();
        bucketOrder.put("Under 18", 0);
        bucketOrder.put("18-24", 1);
        bucketOrder.put("25-34", 2);
        bucketOrder.put("35-44", 3);
        bucketOrder.put("45+", 4);
        bucketOrder.put("Unknown", 5);

        List<DashboardBreakdownItemDTO> items = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String label = Objects.toString(row.get("age_bucket"), "Unknown");
            long count = ((Number) row.get("total")).longValue();
            items.add(new DashboardBreakdownItemDTO(label, count, percentage(count, totalCustomers)));
        }

        items.sort(Comparator
                .comparingInt((DashboardBreakdownItemDTO item) -> bucketOrder.getOrDefault(item.getLabel(), Integer.MAX_VALUE))
                .thenComparing(DashboardBreakdownItemDTO::getLabel, String.CASE_INSENSITIVE_ORDER));
        return items;
    }

    private void releaseExpiredLocks(List<Event> events) {
        events.stream()
                .map(Event::getId)
                .forEach(seatService::releaseExpiredLocks);
    }

    private BigDecimal resolveSeatPrice(Seat seat) {
        if (seat.getPriceTier() == null || seat.getPriceTier().getPrice() == null) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(seat.getPriceTier().getPrice()).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean isSoldSeat(Seat seat) {
        return SOLD_STATUSES.contains(normalizeStatus(seat.getStatus()));
    }

    private boolean isLockedSeat(Seat seat) {
        return LOCKED_STATUSES.contains(normalizeStatus(seat.getStatus()));
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return "Uncategorized";
        }
        return category.trim();
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "DRAFT";
        }
        return status.trim().toUpperCase(Locale.ROOT);
    }

    private BigDecimal percentage(long numerator, long denominator) {
        if (denominator <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }
}
