package com.ticketrush.eventservice.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CloudinaryBannerStorageService {

    private final Cloudinary cloudinary;

    @Value("${cloudinary.folder:ticketrush/event-banners}")
    private String folder;

    public String uploadBanner(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Banner image is required");
        }

        try {
            Map<?, ?> result = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", folder,
                            "public_id", "banner-" + UUID.randomUUID(),
                            "resource_type", "image",
                            "overwrite", false
                    )
            );

            Object secureUrl = result.get("secure_url");
            if (secureUrl == null || secureUrl.toString().isBlank()) {
                throw new RuntimeException("Cloudinary did not return a secure banner URL");
            }
            return secureUrl.toString();
        } catch (IOException exception) {
            throw new RuntimeException("Unable to upload banner image to Cloudinary", exception);
        }
    }
}
