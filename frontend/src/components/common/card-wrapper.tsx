"use client";
const CardWrapper = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="relative">
      <div className="min-h-full flex flex-col justify-center py-10 sm:py-14 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm py-8 px-5 shadow-xl shadow-blue-500/10 sm:rounded-2xl sm:px-10 border border-gray-200/70 dark:border-slate-800/70">
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
