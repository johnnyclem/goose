use url::Url;

fn main() {
    let test_cases = vec![
        (
            "http://localhost:8080/sse",
            "/messages/?session=x2y3z",
            "http://localhost:8080/messages/?session=x2y3z",
        ),
        (
            "http://localhost:8080/mcp/sse",
            "/mcp/messages/xyz",
            "http://localhost:8080/mcp/messages/xyz",
        ),
        (
            "http://localhost:8080/mcp/sse",
            "messages/xyz",
            "http://localhost:8080/mcp/messages/xyz",
        ),
        (
            "http://example.com/api/sse",
            "/messages/xyz",
            "http://example.com/messages/xyz",
        ),
        (
            "http://example.com/api/sse",
            "messages/xyz",
            "http://example.com/api/messages/xyz",
        ),
    ];

    for (base, relative, expected) in test_cases {
        let base_url = Url::parse(base).expect("Invalid base URL");
        let resolved_url = base_url.join(relative).expect("Failed to resolve URL");

        println!(
            "Base: {}\nRelative: {}\nResolved: {}\nExpected: {}\n{}",
            base,
            relative,
            resolved_url,
            expected,
            if resolved_url.as_str() == expected {
                "✅ PASSED"
            } else {
                "❌ FAILED"
            }
        );
        println!("-------------------------------");
    }
}
