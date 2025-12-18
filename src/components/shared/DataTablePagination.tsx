import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
}

export function DataTablePagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    pageSize,
    onPageSizeChange,
}: DataTablePaginationProps) {
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 3; i++) {
                    pages.push(i);
                }
                pages.push(-1); // Ellipsis
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push(-1); // Ellipsis
                for (let i = totalPages - 2; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push(-1); // Ellipsis
                pages.push(currentPage);
                pages.push(-1); // Ellipsis
                pages.push(totalPages);
            }
        }
        return pages;
    };

    if (totalPages <= 1 && !totalItems && !pageSize) return null;

    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4 px-2">
            <div className="flex items-center gap-6 text-sm text-muted-foreground order-2 md:order-1">
                {totalItems !== undefined && (
                    <div className="text-nowrap">
                        Total: {totalItems} records
                    </div>
                )}

                {pageSize && onPageSizeChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-nowrap">Rows per page</span>
                        <Select
                            value={pageSize.toString()}
                            onValueChange={(value) => {
                                onPageSizeChange(Number(value));
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50].map((size) => (
                                    <SelectItem key={size} value={`${size}`}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <Pagination className="mx-0 w-auto justify-end order-1 md:order-2">
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                        </PaginationItem>
                        {getPageNumbers().map((page, index) => (
                            <PaginationItem key={index}>
                                {page === -1 ? (
                                    <PaginationEllipsis />
                                ) : (
                                    <PaginationLink
                                        isActive={currentPage === page}
                                        onClick={() => onPageChange(page)}
                                        className="cursor-pointer"
                                    >
                                        {page}
                                    </PaginationLink>
                                )}
                            </PaginationItem>
                        ))}
                        <PaginationItem>
                            <PaginationNext
                                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </div>
    );
}
