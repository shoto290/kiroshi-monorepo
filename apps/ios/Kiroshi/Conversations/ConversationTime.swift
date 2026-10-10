import Foundation

struct ConversationTime {
    var now: Date = .now
    var calendar: Calendar = .current
    var locale: Locale = .current

    func listLabel(for date: Date) -> String {
        if calendar.isDate(date, inSameDayAs: now) {
            return time(of: date)
        }
        if calendar.isDateInYesterday(date, relativeTo: now) {
            return String(localized: "Yesterday")
        }
        if isThisWeek(date) {
            return date.formatted(style.weekday(.wide))
        }
        return date.formatted(style.day(.twoDigits).month(.twoDigits))
    }

    func threadLabel(for date: Date) -> String {
        let day: String
        if calendar.isDate(date, inSameDayAs: now) {
            day = String(localized: "Today")
        } else if calendar.isDateInYesterday(date, relativeTo: now) {
            day = String(localized: "Yesterday")
        } else if isThisWeek(date) {
            day = date.formatted(style.weekday(.wide))
        } else {
            day = date.formatted(style.day(.twoDigits).month(.twoDigits))
        }
        return "\(day) \(time(of: date))"
    }

    private var style: Date.FormatStyle {
        Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone)
    }

    private func time(of date: Date) -> String {
        date.formatted(
            Date.FormatStyle(
                date: .omitted, time: .shortened, locale: locale, calendar: calendar,
                timeZone: calendar.timeZone))
    }

    private func isThisWeek(_ date: Date) -> Bool {
        guard
            let weekAgo = calendar.date(
                byAdding: .day, value: -6, to: calendar.startOfDay(for: now))
        else { return false }
        return date >= weekAgo && date < now
    }
}

extension Calendar {
    fileprivate func isDateInYesterday(_ date: Date, relativeTo now: Date) -> Bool {
        guard let yesterday = self.date(byAdding: .day, value: -1, to: now) else { return false }
        return isDate(date, inSameDayAs: yesterday)
    }
}
