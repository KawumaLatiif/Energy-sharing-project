"use client";
const CardWrapper = ({
  title,
  subtitle,
  children,
  variant = "default",
  containerClassName,
  cardClassName,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: "default" | "auth";
  containerClassName?: string;
  cardClassName?: string;
}) => {
  const containerBase =
    variant === "auth"
      ? "min-h-screen flex items-center justify-center px-4 py-8"
      : "min-h-full flex flex-col justify-center py-10 sm:py-14 sm:px-6 lg:px-8";
  const cardBase =
    variant === "auth"
      ? "bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm py-8 px-5 shadow-xl shadow-blue-500/10 rounded-2xl sm:px-10 border border-gray-200/70 dark:border-slate-800/70 max-h-[85vh] overflow-y-auto"
      : "bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm py-8 px-5 shadow-xl shadow-blue-500/10 sm:rounded-2xl sm:px-10 border border-gray-200/70 dark:border-slate-800/70";

  return (
    <div className="relative">
      <div className={`${containerBase} ${containerClassName ?? ""}`}>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className={`${cardBase} ${cardClassName ?? ""}`}>
            <h1 className="text-2xl text-center py-3 font-semibold text-gray-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-4">
                {subtitle}
              </p>
            )}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardWrapper;
