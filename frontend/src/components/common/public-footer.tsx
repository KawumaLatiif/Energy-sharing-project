import Link from "next/link";
import Stats from "./stats";

  export default function PublicFooter () {

    const footerNavs = [
        {
            href: '/terms',
            name: 'Terms'
        },
        {
            href: '#',
            name: 'License'
        },
        {
            href: '/privacy',
            name: 'Privacy'
        },
        {
            href: '/about',
            name: 'About us'
        }
    ]
    return (
        <footer className="pt-10 bg-white dark:bg-gray-900">
            <div className="max-w-screen-xl mx-auto px-4 text-gray-600 dark:text-gray-300 md:px-8">
            
                <div className="mt-10 py-10 border-t dark:border-gray-600 items-center justify-between sm:flex">
                    <p>&copy; {new Date().getFullYear()} CCHAIN CERTS LTD. All rights reserved.</p>
                    <ul className="flex flex-wrap items-center gap-4 mt-6 sm:text-sm sm:mt-0">
                        {
                            footerNavs.map((item, idx) => (
                                <li key={idx} className="text-gray-800 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 duration-150">
                                    <Link   href={item.href}>
                                        {item.name}
                                    </Link>
                                </li>
                            ))
                        }
                    </ul>
                </div>
            </div>
        </footer>
    )
}