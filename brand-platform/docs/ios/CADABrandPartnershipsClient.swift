// CADABrandPartnershipsClient.swift
//
// CADA Brand Partnerships — iOS API client (reference implementation)
// Copy into your networking module or adapt to your existing HTTP stack.
//
// Docs: brand-platform/docs/ios-integration-package.md
// OpenAPI: brand-platform/docs/openapi-mobile-v1.yaml
//
// Requires: iOS 15+ (async/await). No third-party dependencies.

import Foundation

// MARK: - Models

public enum HabitType: String, Codable, CaseIterable, Sendable {
    case gym
    case text_friend
    case call_family
    case journal
    case stretch
    case run
    case custom
}

public enum EnrollmentStatus: String, Codable, Sendable {
    case active
    case completed
    case dropped
}

public enum RewardStatus: String, Codable, Sendable {
    case issued
    case redeemed
    case expired
    case revoked
}

public struct BrandSummary: Codable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let slug: String?
    public let logoURL: String?
    public let category: String?

    enum CodingKeys: String, CodingKey {
        case id, name, slug, category
        case logoURL = "logo_url"
    }
}

public struct AvailableChallenge: Codable, Sendable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public let description: String
    public let habitType: HabitType
    public let offerHeadline: String
    public let offerCode: String?
    public let startsAt: Date
    public let endsAt: Date?
    public let brand: BrandSummary

    enum CodingKeys: String, CodingKey {
        case id, title, description, brand
        case habitType = "habit_type"
        case offerHeadline = "offer_headline"
        case offerCode = "offer_code"
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }
}

public struct AvailableChallengesResponse: Codable, Sendable {
    public let challenges: [AvailableChallenge]
    public let meta: Meta

    public struct Meta: Codable, Sendable {
        public let region: String
        public let count: Int
    }
}

public struct EnrollmentResponse: Codable, Sendable {
    public let enrollmentID: String
    public let challengeID: String
    public let status: EnrollmentStatus
    public let enrolledAt: Date
    public let alreadyEnrolled: Bool?

    enum CodingKeys: String, CodingKey {
        case status
        case enrollmentID = "enrollment_id"
        case challengeID = "challenge_id"
        case enrolledAt = "enrolled_at"
        case alreadyEnrolled = "already_enrolled"
    }
}

public struct MyChallengeEnrollment: Codable, Sendable, Identifiable {
    public var id: String { enrollmentID }

    public let enrollmentID: String
    public let challengeID: String
    public let status: EnrollmentStatus
    public let enrolledAt: Date
    public let completedAt: Date?
    public let completionCount: Int
    public let challenge: ChallengeInfo
    public let brand: BrandInfo
    public let progress: Progress
    public let reward: RewardInfo

    public struct ChallengeInfo: Codable, Sendable {
        public let title: String
        public let habitType: HabitType
        public let offerHeadline: String
        public let offerCode: String?
        public let status: String

        enum CodingKeys: String, CodingKey {
            case title, status
            case habitType = "habit_type"
            case offerHeadline = "offer_headline"
            case offerCode = "offer_code"
        }
    }

    public struct BrandInfo: Codable, Sendable {
        public let id: String
        public let name: String
        public let logoURL: String?

        enum CodingKeys: String, CodingKey {
            case id, name
            case logoURL = "logo_url"
        }
    }

    public struct Progress: Codable, Sendable {
        public let rule: String
        public let required: Int
        public let current: Int
        public let completed: Bool
    }

    public struct RewardInfo: Codable, Sendable {
        public let issued: Bool
        public let rewardID: String?

        enum CodingKeys: String, CodingKey {
            case issued
            case rewardID = "reward_id"
        }
    }

    enum CodingKeys: String, CodingKey {
        case status, challenge, brand, progress, reward
        case enrollmentID = "enrollment_id"
        case challengeID = "challenge_id"
        case enrolledAt = "enrolled_at"
        case completedAt = "completed_at"
        case completionCount = "completion_count"
    }
}

public struct MyChallengesResponse: Codable, Sendable {
    public let enrollments: [MyChallengeEnrollment]
}

public struct HabitCompletedRequest: Encodable, Sendable {
    public let habitType: HabitType
    public let completedAt: Date
    public let sourceEventID: String
    public let challengeID: String?

    public init(
        habitType: HabitType,
        completedAt: Date,
        sourceEventID: String,
        challengeID: String? = nil
    ) {
        self.habitType = habitType
        self.completedAt = completedAt
        self.sourceEventID = sourceEventID
        self.challengeID = challengeID
    }

    enum CodingKeys: String, CodingKey {
        case habitType = "habit_type"
        case completedAt = "completed_at"
        case sourceEventID = "source_event_id"
        case challengeID = "challenge_id"
    }
}

public struct IssuedRewardSummary: Codable, Sendable {
    public let id: String
    public let enrollmentID: String
    public let qrURL: String
    public let expiresAt: Date
    public let status: RewardStatus

    enum CodingKeys: String, CodingKey {
        case id, status
        case enrollmentID = "enrollment_id"
        case qrURL = "qr_url"
        case expiresAt = "expires_at"
    }
}

public struct HabitCompletedResponse: Codable, Sendable {
    public let attributed: Bool
    public let reason: String?
    public let idempotentReplay: Bool?
    public let enrollmentID: String?
    public let enrollmentStatus: EnrollmentStatus?
    public let completionCount: Int?
    public let reward: IssuedRewardSummary?

    enum CodingKeys: String, CodingKey {
        case attributed, reason, reward
        case idempotentReplay = "idempotent_replay"
        case enrollmentID = "enrollment_id"
        case enrollmentStatus = "enrollment_status"
        case completionCount = "completion_count"
    }
}

public struct RewardDetail: Codable, Sendable, Identifiable {
    public let id: String
    public let enrollmentID: String
    public let brandID: String
    public let challengeID: String
    public let status: RewardStatus
    public let issuedAt: Date
    public let expiresAt: Date
    public let qrURL: String?
    public let qrPayload: String?
    public let brandName: String
    public let challengeTitle: String
    public let offerHeadline: String
    public let offerCode: String?

    /// Use for QR generation when non-nil.
    public var displayQRPayload: String? { qrURL ?? qrPayload }

    public var isRedeemable: Bool {
        status == .issued && displayQRPayload != nil && expiresAt > Date()
    }

    enum CodingKeys: String, CodingKey {
        case id, status
        case enrollmentID = "enrollment_id"
        case brandID = "brand_id"
        case challengeID = "challenge_id"
        case issuedAt = "issued_at"
        case expiresAt = "expires_at"
        case qrURL = "qr_url"
        case qrPayload = "qr_payload"
        case brandName = "brand_name"
        case challengeTitle = "challenge_title"
        case offerHeadline = "offer_headline"
        case offerCode = "offer_code"
    }
}

// MARK: - Errors

public enum BrandPartnershipsError: Error, Sendable, LocalizedError {
    case unauthorized
    case notFound
    case challengeUnavailable
    case conflict(String)
    case rateLimited
    case notAttributed(reason: String)
    case serverError(statusCode: Int, message: String)
    case decodingFailed(Error)
    case network(Error)

    public var errorDescription: String? {
        switch self {
        case .unauthorized: return "Session expired. Please sign in again."
        case .notFound: return "Resource not found."
        case .challengeUnavailable: return "This offer is no longer available."
        case .conflict(let msg): return msg
        case .rateLimited: return "Too many requests. Try again shortly."
        case .notAttributed(let reason): return "Not attributed: \(reason)"
        case .serverError(_, let message): return message
        case .decodingFailed: return "Unexpected server response."
        case .network(let err): return err.localizedDescription
        }
    }
}

// MARK: - Protocol

/// Brand partnerships API surface for the CADA iOS app.
public protocol BrandPartnershipsAPI: Sendable {
    /// `GET /challenges/available`
    func fetchAvailableChallenges() async throws -> AvailableChallengesResponse

    /// `POST /challenges/{id}/enroll`
    func enroll(challengeID: String) async throws -> EnrollmentResponse

    /// `GET /users/me/challenges`
    func fetchMyChallenges() async throws -> MyChallengesResponse

    /// `POST /events/habit-completed`
    func reportHabitCompleted(_ request: HabitCompletedRequest) async throws -> HabitCompletedResponse

    /// `GET /users/me/rewards/{id}`
    func fetchReward(rewardID: String) async throws -> RewardDetail
}

// MARK: - URLSession implementation

public final class URLSessionBrandPartnershipsClient: BrandPartnershipsAPI, @unchecked Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: @Sendable () async throws -> String
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    /// - Parameters:
    ///   - baseURL: e.g. `URL(string: "https://api.cada.app/v1")!` or `…/api/v1` for local portal
    ///   - tokenProvider: Returns the CADA app user JWT (Supabase access token)
  public init(
        baseURL: URL,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () async throws -> String
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = ISO8601DateFormatter.fractional.date(from: raw)
                ?? ISO8601DateFormatter().date(from: raw) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO8601 date: \(raw)"
            )
        }
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(ISO8601DateFormatter.fractional.string(from: date))
        }
        self.encoder = encoder
    }

    public func fetchAvailableChallenges() async throws -> AvailableChallengesResponse {
        try await get(path: "challenges/available")
    }

    public func enroll(challengeID: String) async throws -> EnrollmentResponse {
        try await post(path: "challenges/\(challengeID)/enroll", body: EmptyBody())
    }

    public func fetchMyChallenges() async throws -> MyChallengesResponse {
        try await get(path: "users/me/challenges")
    }

    public func reportHabitCompleted(_ request: HabitCompletedRequest) async throws -> HabitCompletedResponse {
        try await post(path: "events/habit-completed", body: request)
    }

    public func fetchReward(rewardID: String) async throws -> RewardDetail {
        try await get(path: "users/me/rewards/\(rewardID)")
    }

    // MARK: - HTTP helpers

    private struct EmptyBody: Encodable {}
    private struct APIErrorBody: Decodable { let error: String? }

    private func get<T: Decodable>(path: String) async throws -> T {
        try await request(method: "GET", path: path, body: Optional<Data>.none)
    }

    private func post<Body: Encodable, T: Decodable>(path: String, body: Body) async throws -> T {
        let data = try encoder.encode(body)
        return try await request(method: "POST", path: path, body: data)
    }

    private func request<T: Decodable>(
        method: String,
        path: String,
        body: Data?
    ) async throws -> T {
        let token = try await tokenProvider()
        var url = baseURL
        for component in path.split(separator: "/") {
            url = url.appendingPathComponent(String(component))
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw BrandPartnershipsError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw BrandPartnershipsError.serverError(statusCode: -1, message: "Invalid response")
        }

        if (200 ... 299).contains(http.statusCode) {
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw BrandPartnershipsError.decodingFailed(error)
            }
        }

        let message = (try? decoder.decode(APIErrorBody.self, from: data)).flatMap(\.error)
            ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)

        switch http.statusCode {
        case 401: throw BrandPartnershipsError.unauthorized
        case 404: throw BrandPartnershipsError.notFound
        case 409: throw BrandPartnershipsError.conflict(message)
        case 410: throw BrandPartnershipsError.challengeUnavailable
        case 429: throw BrandPartnershipsError.rateLimited
        default: throw BrandPartnershipsError.serverError(statusCode: http.statusCode, message: message)
        }
    }
}

// MARK: - ISO8601 with fractional seconds

private extension ISO8601DateFormatter {
    static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}

// MARK: - Usage example (remove or move to tests)

/*
@MainActor
final class BrandChallengesCoordinator {
    private let api: BrandPartnershipsAPI

    init(auth: AuthService) {
        api = URLSessionBrandPartnershipsClient(
            baseURL: URL(string: "https://api.cada.app/v1")!,
            tokenProvider: { try await auth.accessToken() }
        )
    }

  func onKnockOut(habitType: HabitType, eventID: String, completedAt: Date) async {
        do {
            let result = try await api.reportHabitCompleted(
                HabitCompletedRequest(
                    habitType: habitType,
                    completedAt: completedAt,
                    sourceEventID: eventID
                )
            )
            guard result.attributed, let reward = result.reward else { return }
            // Navigate to reward screen with reward.id
            // Analytics: challenge_completed, then qr_shown on render
        } catch {
            // See error matrix in ios-integration-package.md
        }
    }
}
*/
