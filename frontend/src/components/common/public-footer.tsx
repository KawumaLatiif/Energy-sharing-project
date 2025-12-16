import Link from "next/link";

export default function PublicFooter() {
  const footerNavs = [
    { href: "/terms", name: "Terms" },
    { href: "/license", name: "License" },
    { href: "/privacy", name: "Privacy" },
    { href: "/about", name: "About" },
  ];

  const socialLinks = [
    {
      href: "#",
      icon: "M9 8h-3v4h-2v-4h-3V7h8v2.014M3 20v-6h6v6H3z m14-9v-5c0-4.97-4.03-9-9-9H3v2c3.87 0 7 3.13 7 7v5h-3v6h12v-6h-3.003M15 20v-6h3v3h2v-3h3v-2h-8v6h2z",
      label: "LinkedIn",
    }, // Placeholder SVG paths; replace with actual icons
    // Add more as needed
  ];

  return (
    <footer className="pt-12 bg-gradient-to-t from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="border-t border-gray-200 dark:border-gray-700 py-10 mt-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} EnergyShare Inc. All rights
            reserved.
          </p>
          <ul className="flex flex-wrap items-center gap-6">
            {footerNavs.map((item, idx) => (
              <li key={idx}>
                <Link
                  href={item.href}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium transition-colors duration-200"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
          {/* Social links */}
          <div className="flex gap-4">
            {socialLinks.map((link, idx) => (
              <Link
                key={idx}
                href={link.href}
                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-full transition-colors"
              >
                {/* Render icon here */}
                <span className="sr-only">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
