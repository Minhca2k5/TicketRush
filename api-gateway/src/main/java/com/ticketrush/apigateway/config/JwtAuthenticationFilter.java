package com.ticketrush.apigateway.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.security.Key;

@Component
public class JwtAuthenticationFilter implements GlobalFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().toString();
        String traceId = exchange.getRequest().getId(); // Use request ID as trace ID
        exchange.getResponse().getHeaders().set("X-Trace-Id", traceId);

        logger.info("Request [{}] to path: {}", traceId, path);

        ServerWebExchange sanitizedExchange = stripUserHeaders(exchange);
        boolean publicEndpoint = isPublicEndpoint(exchange, path);
        String authHeader = sanitizedExchange.getRequest().getHeaders().getFirst("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            if (publicEndpoint) {
                logger.debug("Skipping auth for public endpoint: {}", path);
                return chain.filter(sanitizedExchange);
            }
            logger.warn("Unauthorized access attempt to {}: missing or invalid Authorization header", path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);
        try {
            Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
            String role = String.valueOf(claims.get("role"));
            if (isForbidden(path, role)) {
                logger.warn("Forbidden request [{}] to {} for role {}", traceId, path, role);
                exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                return exchange.getResponse().setComplete();
            }
            logger.debug("JWT validated for request [{}]", traceId);
            ServerHttpRequest request = sanitizedExchange.getRequest().mutate()
                    .header("X-User-Id", claims.getSubject())
                    .header("X-User-Role", role)
                    .header("X-Trace-Id", traceId)
                    .build();
            return chain.filter(sanitizedExchange.mutate().request(request).build());
        } catch (Exception e) {
            if (publicEndpoint) {
                logger.debug("Ignoring invalid optional JWT for public request [{}]: {}", traceId, e.getMessage());
                return chain.filter(sanitizedExchange);
            }
            logger.warn("Invalid JWT for request [{}]: {}", traceId, e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

    }

    private ServerWebExchange stripUserHeaders(ServerWebExchange exchange) {
        ServerHttpRequest request = exchange.getRequest().mutate()
                .headers(headers -> {
                    headers.remove("X-User-Id");
                    headers.remove("X-User-Role");
                    headers.remove("X-Trace-Id");
                })
                .build();
        return exchange.mutate().request(request).build();
    }

    private boolean isPublicEndpoint(ServerWebExchange exchange, String path) {
        HttpMethod method = exchange.getRequest().getMethod();
        return HttpMethod.OPTIONS.equals(method)
                || path.startsWith("/auth/login")
                || path.startsWith("/auth/register")
                || path.startsWith("/auth/verify-email")
                || path.startsWith("/auth/resend-verification")
                || path.startsWith("/api/chatbot")
                || path.startsWith("/ws/events")
                || (HttpMethod.GET.equals(method) && path.startsWith("/api/events"));
    }

    private boolean isForbidden(String path, String role) {
        return isAdminEndpoint(path) && !"ADMIN".equals(role);
    }

    private boolean isAdminEndpoint(String path) {
        return path.startsWith("/auth/dashboard")
                || path.startsWith("/auth/users")
                || path.startsWith("/auth/settings")
                || path.contains("/internal/")
                || path.contains("/admin/");
    }
}
