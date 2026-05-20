package com.ticketrush.authservice.service;

import com.ticketrush.authservice.exception.AuthServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;
import java.util.regex.Pattern;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);
    private static final Pattern SIMPLE_EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:${spring.mail.username:no-reply@ticketrush.local}}")
    private String from;

    @Value("${app.email.require-mx-record:true}")
    private boolean requireMxRecord;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public String normalizeAndValidateRecipient(String email) {
        String normalized = normalizeEmail(email);
        if (!SIMPLE_EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Recipient email is invalid");
        }

        if (requireMxRecord) {
            validateMxRecord(normalized);
        }

        return normalized;
    }

    public void sendOtp(String to, String username, String code, long ttlMinutes, int maxAttempts) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(normalizeAndValidateSender());
        message.setTo(normalizeAndValidateRecipient(to));
        message.setSubject("TicketRush email verification code");

        String expiryUnit = ttlMinutes == 1 ? "minute" : "minutes";
        message.setText(String.format(
                "Hi %s,%n%nYour TicketRush verification code is: %s%n%nThis code expires in %d %s. You can try up to %d times.%nIf you did not request this account, you can ignore this email.",
                username,
                code,
                ttlMinutes,
                expiryUnit,
                maxAttempts
        ));

        mailSender.send(message);
        logger.info("Verification email sent to {}", to);
    }

    private String normalizeAndValidateSender() {
        String normalized = normalizeEmail(from);
        if (!SIMPLE_EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new AuthServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Mail sender address is invalid");
        }
        return normalized;
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private void validateMxRecord(String email) {
        String domain = email.substring(email.lastIndexOf('@') + 1);
        Hashtable<String, String> environment = new Hashtable<>();
        environment.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");

        try {
            Attributes attributes = new InitialDirContext(environment).getAttributes(domain, new String[]{"MX"});
            Attribute mxRecords = attributes.get("MX");
            if (mxRecords == null || mxRecords.size() == 0) {
                throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Email domain cannot receive mail");
            }
        } catch (NamingException exception) {
            logger.warn("Email domain MX lookup failed for {}", domain, exception);
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Email domain cannot receive mail");
        }
    }
}
