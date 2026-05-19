package com.ticketrush.bookingservice.service;

import com.ticketrush.bookingservice.dto.EventDTO;
import com.ticketrush.bookingservice.dto.OrderDTO;
import com.ticketrush.bookingservice.dto.TicketDTO;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

@Service
public class BookingEmailService {
    private static final Logger logger = LoggerFactory.getLogger(BookingEmailService.class);
    private static final Pattern SIMPLE_EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm");

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:${spring.mail.username:no-reply@ticketrush.local}}")
    private String from;

    public BookingEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendBookingConfirmation(String to, String customerName, OrderDTO order, EventDTO event) {
        String recipient = normalizeEmail(to);
        if (!SIMPLE_EMAIL_PATTERN.matcher(recipient).matches()) {
            logger.info("Skipping booking confirmation because recipient is missing or invalid");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(resolveSender());
            helper.setTo(recipient);
            helper.setSubject("TicketRush booking confirmation - Order #" + order.getId());
            helper.setText(buildPlainText(customerName, order, event), buildHtml(customerName, order, event));
            mailSender.send(message);
            logger.info("Booking confirmation email sent to {}", recipient);
        } catch (Exception exception) {
            logger.warn("Booking confirmation email could not be sent to {}", recipient, exception);
        }
    }

    private String buildPlainText(String customerName, OrderDTO order, EventDTO event) {
        StringBuilder builder = new StringBuilder();
        builder.append("Hi ").append(defaultIfBlank(customerName, "there")).append(",\n\n");
        builder.append("Your TicketRush order #").append(order.getId()).append(" is confirmed.\n");
        builder.append("Event: ").append(resolveEventName(event)).append("\n");
        builder.append("Time: ").append(resolveEventTime(event)).append("\n");
        builder.append("Venue: ").append(resolveVenue(event)).append("\n");
        builder.append("Total: $").append(formatMoney(order.getTotalPrice())).append("\n\n");
        builder.append("Tickets:\n");
        for (TicketDTO ticket : order.getTickets()) {
            builder.append("- Ticket #").append(ticket.getId())
                    .append(", seat ID ").append(ticket.getSeatId())
                    .append(", QR token ").append(ticket.getQrCodeToken())
                    .append("\n");
        }
        return builder.toString();
    }

    private String buildHtml(String customerName, OrderDTO order, EventDTO event) {
        StringBuilder ticketsHtml = new StringBuilder();
        for (TicketDTO ticket : order.getTickets()) {
            String qrValue = encode(ticket.getQrCodeToken());
            String qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + qrValue;
            ticketsHtml.append("""
                    <tr>
                      <td style="padding:16px;border-top:1px solid #e5e7eb;">
                        <strong>Ticket #%s</strong><br>
                        <span style="color:#64748b;">Seat ID: %s</span><br>
                        <span style="color:#64748b;">QR token: %s</span>
                      </td>
                      <td style="padding:16px;border-top:1px solid #e5e7eb;text-align:right;">
                        <img alt="Ticket QR code" width="120" height="120" src="%s">
                      </td>
                    </tr>
                    """.formatted(ticket.getId(), ticket.getSeatId(), escape(ticket.getQrCodeToken()), qrUrl));
        }

        return """
                <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
                  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
                    <div style="padding:28px;background:#4f46e5;color:white;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">TicketRush</div>
                      <h1 style="margin:10px 0 0;font-size:28px;">Booking confirmed</h1>
                    </div>
                    <div style="padding:28px;">
                      <p style="margin:0 0 16px;">Hi %s, your order <strong>#%s</strong> has been paid successfully.</p>
                      <table style="width:100%%;border-collapse:collapse;background:#f8fafc;border-radius:14px;margin:18px 0;">
                        <tr><td style="padding:10px 14px;color:#64748b;">Event</td><td style="padding:10px 14px;text-align:right;font-weight:700;">%s</td></tr>
                        <tr><td style="padding:10px 14px;color:#64748b;">Time</td><td style="padding:10px 14px;text-align:right;">%s</td></tr>
                        <tr><td style="padding:10px 14px;color:#64748b;">Venue</td><td style="padding:10px 14px;text-align:right;">%s</td></tr>
                        <tr><td style="padding:10px 14px;color:#64748b;">Total</td><td style="padding:10px 14px;text-align:right;font-weight:700;">$%s</td></tr>
                      </table>
                      <h2 style="margin:24px 0 8px;font-size:20px;">Your tickets</h2>
                      <table style="width:100%%;border-collapse:collapse;">%s</table>
                      <p style="margin:22px 0 0;color:#64748b;font-size:13px;">Present the QR code at the entrance. You can also view these tickets in TicketRush My Tickets.</p>
                    </div>
                  </div>
                </div>
                """.formatted(
                escape(defaultIfBlank(customerName, "there")),
                order.getId(),
                escape(resolveEventName(event)),
                escape(resolveEventTime(event)),
                escape(resolveVenue(event)),
                formatMoney(order.getTotalPrice()),
                ticketsHtml
        );
    }

    private String resolveSender() {
        String sender = normalizeEmail(from);
        return SIMPLE_EMAIL_PATTERN.matcher(sender).matches() ? sender : "no-reply@ticketrush.local";
    }

    private String resolveEventName(EventDTO event) {
        return event != null && event.getName() != null ? event.getName() : "TicketRush event";
    }

    private String resolveEventTime(EventDTO event) {
        if (event == null || event.getStartTime() == null) {
            return "TBD";
        }
        return event.getStartTime().format(DATE_FORMAT);
    }

    private String resolveVenue(EventDTO event) {
        if (event == null) return "Venue TBD";
        if (event.getVenue() != null && event.getVenue().getName() != null) return event.getVenue().getName();
        if (event.getLocation() != null) return event.getLocation();
        return "Venue TBD";
    }

    private String formatMoney(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String escape(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
